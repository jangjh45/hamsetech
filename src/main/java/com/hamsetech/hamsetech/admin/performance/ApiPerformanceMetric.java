package com.hamsetech.hamsetech.admin.performance;

public record ApiPerformanceMetric(
        String method,
        String path,
        long requests,
        long serverErrors,
        double errorRatePercent,
        Double averageLatencyMs,
        Double p95LatencyMs,
        Double p99LatencyMs) {
}
