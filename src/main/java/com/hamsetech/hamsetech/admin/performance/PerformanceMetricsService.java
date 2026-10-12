package com.hamsetech.hamsetech.admin.performance;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicLongArray;

/**
 * API 요청의 최근 60초 통계를 메모리에서만 유지한다.
 * 요청 경로별 태그나 DB 기록을 만들지 않아 저사양 운영 서버의 부담과 메모리를 제한한다.
 */
@Service
public class PerformanceMetricsService {

    private static final int WINDOW_SECONDS = 60;
    private static final int SUB_BUCKETS_PER_DOUBLING = 8;
    private static final int LATENCY_BUCKET_COUNT = 64 * SUB_BUCKETS_PER_DOUBLING;

    private final MeterRegistry meterRegistry;
    private final ConcurrentHashMap<Long, SecondBucket> buckets = new ConcurrentHashMap<>();
    private final AtomicLong lastCleanupSecond = new AtomicLong(Long.MIN_VALUE);

    public PerformanceMetricsService(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    public void recordRequest(long durationNanos, int status) {
        recordRequestAt(Instant.now().getEpochSecond(), durationNanos, status);
    }

    void recordRequestAt(long epochSecond, long durationNanos, int status) {
        SecondBucket bucket = buckets.computeIfAbsent(epochSecond, ignored -> new SecondBucket());
        bucket.requests.incrementAndGet();
        if (status >= 500) {
            bucket.serverErrors.incrementAndGet();
        }
        long safeDuration = Math.max(0, durationNanos);
        bucket.totalDurationNanos.addAndGet(safeDuration);
        bucket.latencyHistogram.incrementAndGet(latencyBucket(safeDuration));

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

        return new PerformanceSnapshot(
                Instant.ofEpochSecond(nowEpochSecond),
                requestsLast5Seconds,
                requestsLast60Seconds,
                serverErrorsLast60Seconds,
                requestsLast5Seconds / 5.0,
                errorRate,
                averageLatencyMs,
                percentileMs(histogram, requestsLast60Seconds, 0.50),
                percentileMs(histogram, requestsLast60Seconds, 0.95),
                percentileMs(histogram, requestsLast60Seconds, 0.99),
                sumGauge("jvm.memory.used", "area", "heap"),
                sumGauge("jvm.memory.max", "area", "heap"),
                firstAvailableGauge("hikaricp.connections.active", "jdbc.connections.active"),
                firstAvailableGauge("hikaricp.connections.max", "jdbc.connections.max"));
    }

    private Double sumGauge(String name, String tagKey, String tagValue) {
        var gauges = meterRegistry.find(name).tag(tagKey, tagValue).gauges();
        if (gauges.isEmpty()) {
            return null;
        }
        return gauges.stream().mapToDouble(Gauge::value).filter(Double::isFinite).sum();
    }

    private Double firstAvailableGauge(String... names) {
        for (String name : names) {
            var gauges = meterRegistry.find(name).gauges();
            if (!gauges.isEmpty()) {
                return gauges.stream().mapToDouble(Gauge::value).filter(Double::isFinite).sum();
            }
        }
        return null;
    }

    private static Double percentileMs(long[] histogram, long count, double percentile) {
        if (count == 0) {
            return null;
        }

        long targetRank = (long) Math.ceil(count * percentile);
        long seen = 0;
        for (int i = 0; i < histogram.length; i++) {
            seen += histogram[i];
            if (seen >= targetRank) {
                int exponent = i / SUB_BUCKETS_PER_DOUBLING;
                int subBucket = i % SUB_BUCKETS_PER_DOUBLING;
                double upperBoundNanos = Math.scalb(1.0, exponent)
                        * (1.0 + (subBucket + 1.0) / SUB_BUCKETS_PER_DOUBLING);
                return upperBoundNanos / 1_000_000.0;
            }
        }
        return null;
    }

    private static int latencyBucket(long durationNanos) {
        if (durationNanos <= 1) {
            return 0;
        }
        int exponent = 63 - Long.numberOfLeadingZeros(durationNanos);
        long base = 1L << exponent;
        int subBucket = (int) (((durationNanos - base) / (double) base) * SUB_BUCKETS_PER_DOUBLING);
        subBucket = Math.min(SUB_BUCKETS_PER_DOUBLING - 1, subBucket);
        return exponent * SUB_BUCKETS_PER_DOUBLING + subBucket;
    }

    private static final class SecondBucket {
        private final AtomicLong requests = new AtomicLong();
        private final AtomicLong serverErrors = new AtomicLong();
        private final AtomicLong totalDurationNanos = new AtomicLong();
        private final AtomicLongArray latencyHistogram = new AtomicLongArray(LATENCY_BUCKET_COUNT);
    }
}
