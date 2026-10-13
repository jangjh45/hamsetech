package com.hamsetech.hamsetech.admin.performance;

import java.time.Instant;

/** 최근 60초 동안 애플리케이션이 관측한 성능 요약. */
public record PerformanceSnapshot(
        Instant capturedAt,
        long requestsLast5Seconds,
        long requestsLast60Seconds,
        long serverErrorsLast60Seconds,
        double requestsPerSecond,
        double errorRatePercent,
        Double averageLatencyMs,
        Double p50LatencyMs,
        Double p95LatencyMs,
        Double p99LatencyMs,
        Double jvmHeapUsedBytes,
        Double jvmHeapMaxBytes,
        Double dbConnectionsActive,
        Double dbConnectionsIdle,
        Double dbConnectionsPending,
        Double dbConnectionsMax,
        Double jvmNonHeapUsedBytes,
        Double jvmNonHeapMaxBytes,
        Double processCpuPercent,
        Double systemCpuPercent,
        Double containerMemoryUsedBytes,
        Double containerMemoryMaxBytes,
        Double systemMemoryUsedBytes,
        Double systemMemoryTotalBytes,
        Double uploadStorageUsableBytes,
        Double uploadStorageTotalBytes) {
}
