package com.hamsetech.hamsetech.admin.performance;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/performance")
public class PerformanceMetricsController {

    private final PerformanceMetricsService metricsService;

    public PerformanceMetricsController(PerformanceMetricsService metricsService) {
        this.metricsService = metricsService;
    }

    @GetMapping
    public PerformanceSnapshot getSnapshot() {
        return metricsService.snapshot();
    }
}
