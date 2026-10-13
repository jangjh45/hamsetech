package com.hamsetech.hamsetech.admin.performance;

public record PerformanceThresholds(
        double p95LatencyMs,
        double errorRatePercent,
        double heapUsedPercent,
        double dbPoolUsedPercent,
        double containerMemoryUsedPercent,
        double systemCpuPercent,
        double systemMemoryUsedPercent,
        double uploadStorageFreePercent) {
}
