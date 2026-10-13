package com.hamsetech.hamsetech.admin.performance;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.nio.file.FileStore;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicLongArray;

/**
 * API 요청의 최근 60초 통계를 메모리에서 유지한다.
 * 경로의 변수 세그먼트는 마스킹하고 초당 경로 수를 제한해 저사양 운영 서버의
 * 메모리 사용량과 개인정보 노출을 제한한다.
 */
@Service
public class PerformanceMetricsService {

    private static final int WINDOW_SECONDS = 60;
    private static final int SUB_BUCKETS_PER_DOUBLING = 8;
    private static final int LATENCY_BUCKET_COUNT = 64 * SUB_BUCKETS_PER_DOUBLING;
    private static final int ROUTE_SUB_BUCKETS_PER_DOUBLING = 4;
    private static final int ROUTE_BUCKET_COUNT = 64 * ROUTE_SUB_BUCKETS_PER_DOUBLING;
    private static final int MAX_ROUTES_PER_SECOND = 32;
    private static final int MAX_ENDPOINTS_IN_RESPONSE = 15;
    private static final Set<String> STATIC_PATH_SEGMENTS = Set.of(
            "api", "auth", "register", "login", "change-password", "todos", "date",
            "admin", "ping", "users", "approve", "reject", "grant-admin", "revoke-admin",
            "withdraw", "display-name", "reset-password", "unlock-login", "logs", "read", "stats",
            "notices", "attachments", "content", "neighbors", "pin", "comments", "scenarios",
            "favorites", "search", "favorite", "calendar", "overtime-records", "me", "bulk",
            "export", "summary", "defaults", "vendor-categories", "manage", "vendors", "email",
            "avatar", "avatars");

    private final MeterRegistry meterRegistry;
    private final Path uploadDirectory;
    private final ConcurrentHashMap<Long, SecondBucket> buckets = new ConcurrentHashMap<>();
    private final AtomicLong lastCleanupSecond = new AtomicLong(Long.MIN_VALUE);
    private final com.sun.management.OperatingSystemMXBean operatingSystemBean = operatingSystemBean();

    public PerformanceMetricsService(MeterRegistry meterRegistry,
                                     @Value("${app.upload.dir:./uploads}") String uploadDirectory) {
        this.meterRegistry = meterRegistry;
        this.uploadDirectory = Path.of(uploadDirectory).toAbsolutePath().normalize();
    }

    public void recordRequest(long durationNanos, int status) {
        recordRequest(durationNanos, status, "UNKNOWN", "/api/other");
    }

    public void recordRequest(long durationNanos, int status, String method, String requestUri) {
        recordRequestAt(Instant.now().getEpochSecond(), durationNanos, status, method, requestUri);
    }

    void recordRequestAt(long epochSecond, long durationNanos, int status) {
        recordRequestAt(epochSecond, durationNanos, status, "UNKNOWN", "/api/other");
    }

    void recordRequestAt(long epochSecond, long durationNanos, int status, String method, String requestUri) {
        SecondBucket bucket = buckets.computeIfAbsent(epochSecond, ignored -> new SecondBucket());
        bucket.requests.incrementAndGet();
        if (status >= 500) {
            bucket.serverErrors.incrementAndGet();
        }
        long safeDuration = Math.max(0, durationNanos);
        bucket.totalDurationNanos.addAndGet(safeDuration);
        bucket.latencyHistogram.incrementAndGet(latencyBucket(safeDuration));

        RouteKey routeKey = normalizedRoute(method, requestUri);
        if (routeKey != null) {
            RouteBucket route = bucket.routes.get(routeKey);
            if (route == null) {
                synchronized (bucket.routes) {
                    route = bucket.routes.get(routeKey);
                    if (route == null && bucket.routes.size() < MAX_ROUTES_PER_SECOND) {
                        route = new RouteBucket();
                        bucket.routes.put(routeKey, route);
                    }
                }
            }
            if (route != null) {
                route.record(safeDuration, status);
            }
        }

        long previousCleanup = lastCleanupSecond.get();
        if (epochSecond > previousCleanup && lastCleanupSecond.compareAndSet(previousCleanup, epochSecond)) {
            long oldestSecond = epochSecond - WINDOW_SECONDS + 1;
            buckets.keySet().removeIf(second -> second < oldestSecond);
        }
    }

    public PerformanceSnapshot snapshot() {
        return snapshotAt(Instant.now().getEpochSecond());
    }

    PerformanceSnapshot snapshotAt(long nowEpochSecond) {
        long requestsLast5Seconds = 0;
        long requestsLast60Seconds = 0;
        long serverErrorsLast60Seconds = 0;
        long totalDurationNanos = 0;
        long[] histogram = new long[LATENCY_BUCKET_COUNT];

        for (Map.Entry<Long, SecondBucket> entry : buckets.entrySet()) {
            long second = entry.getKey();
            if (second > nowEpochSecond || second < nowEpochSecond - WINDOW_SECONDS + 1) {
                continue;
            }

            SecondBucket bucket = entry.getValue();
            long count = bucket.requests.get();
            requestsLast60Seconds += count;
            serverErrorsLast60Seconds += bucket.serverErrors.get();
            totalDurationNanos += bucket.totalDurationNanos.get();
            if (second >= nowEpochSecond - 4) {
                requestsLast5Seconds += count;
            }
            for (int i = 0; i < LATENCY_BUCKET_COUNT; i++) {
                histogram[i] += bucket.latencyHistogram.get(i);
            }
        }

        double errorRate = requestsLast60Seconds == 0
                ? 0
                : serverErrorsLast60Seconds * 100.0 / requestsLast60Seconds;
        Double averageLatencyMs = requestsLast60Seconds == 0
                ? null
                : totalDurationNanos / (double) requestsLast60Seconds / 1_000_000.0;
        SystemMemory systemMemory = systemMemory();

        return new PerformanceSnapshot(
                Instant.ofEpochSecond(nowEpochSecond),
                requestsLast5Seconds,
                requestsLast60Seconds,
                serverErrorsLast60Seconds,
                requestsLast5Seconds / 5.0,
                errorRate,
                averageLatencyMs,
                percentileMs(histogram, requestsLast60Seconds, 0.50, SUB_BUCKETS_PER_DOUBLING),
                percentileMs(histogram, requestsLast60Seconds, 0.95, SUB_BUCKETS_PER_DOUBLING),
                percentileMs(histogram, requestsLast60Seconds, 0.99, SUB_BUCKETS_PER_DOUBLING),
                sumGauge("jvm.memory.used", "area", "heap"),
                sumGauge("jvm.memory.max", "area", "heap"),
                firstAvailableGauge("hikaricp.connections.active", "jdbc.connections.active"),
                firstAvailableGauge("hikaricp.connections.idle"),
                firstAvailableGauge("hikaricp.connections.pending"),
                firstAvailableGauge("hikaricp.connections.max", "jdbc.connections.max"),
                sumGauge("jvm.memory.used", "area", "nonheap"),
                sumGauge("jvm.memory.max", "area", "nonheap"),
                processCpuPercent(),
                systemCpuPercent(),
                cgroupMemoryValue("memory.current", "memory/memory.usage_in_bytes"),
                cgroupMemoryValue("memory.max", "memory/memory.limit_in_bytes"),
                systemMemory.usedBytes(),
                systemMemory.totalBytes(),
                uploadStorageValue(false),
                uploadStorageValue(true));
    }

    public List<ApiPerformanceMetric> endpointSnapshot() {
        return endpointSnapshotAt(Instant.now().getEpochSecond());
    }

    List<ApiPerformanceMetric> endpointSnapshotAt(long nowEpochSecond) {
        return endpointMinuteSnapshotAt(nowEpochSecond).stream()
                .sorted(endpointP95Order())
                .limit(MAX_ENDPOINTS_IN_RESPONSE)
                .map(endpoint -> new ApiPerformanceMetric(
                        endpoint.method(), endpoint.path(), endpoint.requests(), endpoint.serverErrors(),
                        endpoint.serverErrors() * 100.0 / endpoint.requests(),
                        endpoint.totalDurationNanos() / (double) endpoint.requests() / 1_000_000.0,
                        endpoint.p95LatencyMs(), endpoint.p99LatencyMs()))
                .toList();
    }

    List<PerformanceEndpointMinute> endpointMinuteSnapshotAt(long nowEpochSecond) {
        Map<RouteKey, RouteAccumulator> totals = new HashMap<>();
        for (Map.Entry<Long, SecondBucket> entry : buckets.entrySet()) {
            long second = entry.getKey();
            if (second > nowEpochSecond || second < nowEpochSecond - WINDOW_SECONDS + 1) {
                continue;
            }
            entry.getValue().routes.forEach((key, value) ->
                    totals.computeIfAbsent(key, ignored -> new RouteAccumulator()).add(value));
        }

        List<PerformanceEndpointMinute> result = new ArrayList<>();
        totals.forEach((key, value) -> {
            if (value.requests == 0) return;
            result.add(new PerformanceEndpointMinute(
                    key.method(), key.path(), value.requests, value.serverErrors, value.totalDurationNanos,
                    percentileMs(value.histogram, value.requests, 0.95, ROUTE_SUB_BUCKETS_PER_DOUBLING),
                    percentileMs(value.histogram, value.requests, 0.99, ROUTE_SUB_BUCKETS_PER_DOUBLING)));
        });
        Map<EndpointIdentity, PerformanceEndpointMinute> selected = new LinkedHashMap<>();
        addTopEndpoints(result, endpointP95Order(), selected);
        addTopEndpoints(result, endpointErrorRateOrder(), selected);
        addTopEndpoints(result, endpointRequestOrder(), selected);
        return List.copyOf(selected.values());
    }

    private static void addTopEndpoints(List<PerformanceEndpointMinute> endpoints,
                                        Comparator<PerformanceEndpointMinute> order,
                                        Map<EndpointIdentity, PerformanceEndpointMinute> selected) {
        endpoints.stream().sorted(order).limit(MAX_ENDPOINTS_IN_RESPONSE).forEach(endpoint ->
                selected.putIfAbsent(new EndpointIdentity(endpoint.method(), endpoint.path()), endpoint));
    }

    private static Comparator<PerformanceEndpointMinute> endpointP95Order() {
        return Comparator.comparing(PerformanceEndpointMinute::p95LatencyMs,
                        Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(PerformanceEndpointMinute::requests, Comparator.reverseOrder());
    }

    private static Comparator<PerformanceEndpointMinute> endpointErrorRateOrder() {
        return Comparator.comparingDouble((PerformanceEndpointMinute endpoint) ->
                        endpoint.serverErrors() / (double) endpoint.requests())
                .reversed().thenComparing(PerformanceEndpointMinute::requests, Comparator.reverseOrder());
    }

    private static Comparator<PerformanceEndpointMinute> endpointRequestOrder() {
        return Comparator.comparing(PerformanceEndpointMinute::requests, Comparator.reverseOrder())
                .thenComparing(PerformanceEndpointMinute::p95LatencyMs,
                        Comparator.nullsLast(Comparator.reverseOrder()));
    }

    private Double sumGauge(String name, String tagKey, String tagValue) {
        var gauges = meterRegistry.find(name).tag(tagKey, tagValue).gauges();
        if (gauges.isEmpty()) {
            return null;
        }
        double[] values = gauges.stream().mapToDouble(Gauge::value)
                .filter(value -> Double.isFinite(value) && value >= 0).toArray();
        return values.length == 0 ? null : java.util.Arrays.stream(values).sum();
    }

    private Double firstAvailableGauge(String... names) {
        for (String name : names) {
            var gauges = meterRegistry.find(name).gauges();
            if (!gauges.isEmpty()) {
                double[] values = gauges.stream().mapToDouble(Gauge::value)
                        .filter(value -> Double.isFinite(value) && value >= 0).toArray();
                if (values.length > 0) return java.util.Arrays.stream(values).sum();
            }
        }
        return null;
    }

    private static Double percentileMs(long[] histogram, long count, double percentile, int subBucketsPerDoubling) {
        if (count == 0) {
            return null;
        }

        long targetRank = (long) Math.ceil(count * percentile);
        long seen = 0;
        for (int i = 0; i < histogram.length; i++) {
            seen += histogram[i];
            if (seen >= targetRank) {
                int exponent = i / subBucketsPerDoubling;
                int subBucket = i % subBucketsPerDoubling;
                double upperBoundNanos = Math.scalb(1.0, exponent)
                        * (1.0 + (subBucket + 1.0) / subBucketsPerDoubling);
                return upperBoundNanos / 1_000_000.0;
            }
        }
        return null;
    }

    private static int latencyBucket(long durationNanos) {
        return latencyBucket(durationNanos, SUB_BUCKETS_PER_DOUBLING);
    }

    private static int latencyBucket(long durationNanos, int subBucketsPerDoubling) {
        if (durationNanos <= 1) {
            return 0;
        }
        int exponent = 63 - Long.numberOfLeadingZeros(durationNanos);
        long base = 1L << exponent;
        int subBucket = (int) (((durationNanos - base) / (double) base) * subBucketsPerDoubling);
        subBucket = Math.min(subBucketsPerDoubling - 1, subBucket);
        return exponent * subBucketsPerDoubling + subBucket;
    }

    private Double processCpuPercent() {
        if (operatingSystemBean == null) return null;
        double load = operatingSystemBean.getProcessCpuLoad();
        return Double.isFinite(load) && load >= 0 ? load * 100 : null;
    }

    private Double systemCpuPercent() {
        if (operatingSystemBean == null) return null;
        double load = operatingSystemBean.getCpuLoad();
        return Double.isFinite(load) && load >= 0 ? load * 100 : null;
    }

    private Double uploadStorageValue(boolean total) {
        try {
            FileStore store = Files.getFileStore(uploadDirectory);
            return (double) (total ? store.getTotalSpace() : store.getUsableSpace());
        } catch (IOException | SecurityException ignored) {
            return null;
        }
    }

    private static SystemMemory systemMemory() {
        try {
            long totalBytes = 0;
            long availableBytes = -1;
            for (String line : Files.readAllLines(Path.of("/proc/meminfo"))) {
                String[] parts = line.split("\\s+");
                if (parts.length < 2) continue;
                if (parts[0].equals("MemTotal:")) totalBytes = Long.parseLong(parts[1]) * 1024;
                if (parts[0].equals("MemAvailable:")) availableBytes = Long.parseLong(parts[1]) * 1024;
            }
            if (totalBytes <= 0 || availableBytes < 0) return new SystemMemory(null, null);
            return new SystemMemory((double) Math.max(0, totalBytes - availableBytes), (double) totalBytes);
        } catch (IOException | NumberFormatException | SecurityException ignored) {
            return new SystemMemory(null, null);
        }
    }

    private static Double cgroupMemoryValue(String v2Name, String v1RelativePath) {
        for (Path path : List.of(Path.of("/sys/fs/cgroup", v2Name), Path.of("/sys/fs/cgroup", v1RelativePath))) {
            try {
                String raw = Files.readString(path).trim();
                if (raw.equals("max")) return null;
                long value = Long.parseLong(raw);
                // cgroup v1 may expose a sentinel near Long.MAX_VALUE when unlimited.
                if (value < 0 || value >= Long.MAX_VALUE / 2) return null;
                return (double) value;
            } catch (IOException | NumberFormatException | SecurityException ignored) {
                // Try the other cgroup layout.
            }
        }
        return null;
    }

    private static com.sun.management.OperatingSystemMXBean operatingSystemBean() {
        var bean = ManagementFactory.getOperatingSystemMXBean();
        return bean instanceof com.sun.management.OperatingSystemMXBean extended ? extended : null;
    }

    private record SystemMemory(Double usedBytes, Double totalBytes) {}

    private static RouteKey normalizedRoute(String method, String requestUri) {
        if (requestUri == null || !requestUri.startsWith("/api/")) return null;
        String path = requestUri.split("\\?", 2)[0];
        if (path.length() > 160) return new RouteKey(normalizeMethod(method), "/api/{other}");
        StringBuilder normalized = new StringBuilder();
        String[] segments = path.split("/");
        int segmentCount = Math.min(segments.length, 10);
        for (int i = 0; i < segmentCount; i++) {
            if (segments[i].isEmpty()) continue;
            normalized.append('/');
            String segment = segments[i].toLowerCase(Locale.ROOT);
            if (STATIC_PATH_SEGMENTS.contains(segment)) {
                normalized.append(segment);
            } else {
                normalized.append("{id}");
            }
        }
        if (segments.length > segmentCount) normalized.append("/{other}");
        return new RouteKey(normalizeMethod(method), normalized.length() == 0 ? "/api/{other}" : normalized.toString());
    }

    private static String normalizeMethod(String method) {
        if (method == null || method.isBlank()) return "UNKNOWN";
        String normalized = method.toUpperCase(Locale.ROOT);
        return Set.of("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS").contains(normalized)
                ? normalized : "OTHER";
    }

    private static final class SecondBucket {
        private final AtomicLong requests = new AtomicLong();
        private final AtomicLong serverErrors = new AtomicLong();
        private final AtomicLong totalDurationNanos = new AtomicLong();
        private final AtomicLongArray latencyHistogram = new AtomicLongArray(LATENCY_BUCKET_COUNT);
        private final ConcurrentHashMap<RouteKey, RouteBucket> routes = new ConcurrentHashMap<>();
    }

    private record RouteKey(String method, String path) {}

    private record EndpointIdentity(String method, String path) {}

    private static final class RouteBucket {
        private final AtomicLong requests = new AtomicLong();
        private final AtomicLong serverErrors = new AtomicLong();
        private final AtomicLong totalDurationNanos = new AtomicLong();
        private final AtomicLongArray histogram = new AtomicLongArray(ROUTE_BUCKET_COUNT);

        private void record(long durationNanos, int status) {
            requests.incrementAndGet();
            if (status >= 500) serverErrors.incrementAndGet();
            totalDurationNanos.addAndGet(durationNanos);
            histogram.incrementAndGet(latencyBucket(durationNanos, ROUTE_SUB_BUCKETS_PER_DOUBLING));
        }
    }

    private static final class RouteAccumulator {
        private long requests;
        private long serverErrors;
        private long totalDurationNanos;
        private final long[] histogram = new long[ROUTE_BUCKET_COUNT];

        private void add(RouteBucket bucket) {
            requests += bucket.requests.get();
            serverErrors += bucket.serverErrors.get();
            totalDurationNanos += bucket.totalDurationNanos.get();
            for (int i = 0; i < histogram.length; i++) histogram[i] += bucket.histogram.get(i);
        }
    }
}
