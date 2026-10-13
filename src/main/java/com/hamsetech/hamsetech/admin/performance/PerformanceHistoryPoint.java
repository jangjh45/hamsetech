package com.hamsetech.hamsetech.admin.performance;

import java.time.Instant;

public record PerformanceHistoryPoint(
        Instant capturedAt,
        double requestsPerSecond,
        double errorRatePercent,
        Double p95LatencyMs,
        Double jvmHeapUsedBytes,
        Double jvmHeapMaxBytes,
        Double dbConnectionsActive,
        Double dbConnectionsMax,
        Double systemCpuPercent,
        Double containerMemoryUsedBytes,
        Double containerMemoryMaxBytes,
        Double systemMemoryUsedBytes,
        Double systemMemoryTotalBytes) {
}
