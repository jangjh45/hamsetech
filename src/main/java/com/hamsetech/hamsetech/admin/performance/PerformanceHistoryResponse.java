package com.hamsetech.hamsetech.admin.performance;

import java.time.Instant;
import java.util.List;

public record PerformanceHistoryResponse(
        String range,
        Instant capturedAt,
        Instant oldestAvailable,
        int retentionDays,
        List<PerformanceHistoryPoint> points) {
}
