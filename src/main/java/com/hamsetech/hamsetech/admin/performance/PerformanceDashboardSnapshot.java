package com.hamsetech.hamsetech.admin.performance;

import java.util.List;

public record PerformanceDashboardSnapshot(
        PerformanceSnapshot current,
        List<ApiPerformanceMetric> endpoints,
        PerformanceThresholds thresholds) {
}
