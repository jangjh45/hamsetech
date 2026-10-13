package com.hamsetech.hamsetech.admin.performance;

/** Bounded, normalized route aggregate captured once per minute. */
public record PerformanceEndpointMinute(
        String method,
        String path,
        long requests,
        long serverErrors,
        long totalDurationNanos,
        Double p95LatencyMs,
        Double p99LatencyMs) {
}
