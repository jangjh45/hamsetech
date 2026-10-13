package com.hamsetech.hamsetech.admin.performance;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/performance")
public class PerformanceMetricsController {

    private final PerformanceMetricsService metricsService;
    private final PerformanceHistoryService historyService;
    private final PerformanceEndpointHistoryService endpointHistoryService;
    private final PerformanceAlertSettingsService alertSettingsService;
    private final PerformanceAlertService alertService;

    public PerformanceMetricsController(PerformanceMetricsService metricsService,
                                        PerformanceHistoryService historyService,
                                        PerformanceEndpointHistoryService endpointHistoryService,
                                        PerformanceAlertSettingsService alertSettingsService,
                                        PerformanceAlertService alertService) {
        this.metricsService = metricsService;
        this.historyService = historyService;
        this.endpointHistoryService = endpointHistoryService;
        this.alertSettingsService = alertSettingsService;
        this.alertService = alertService;
    }

    @GetMapping
    public PerformanceDashboardSnapshot getSnapshot() {
        return new PerformanceDashboardSnapshot(
                metricsService.snapshot(), metricsService.endpointSnapshot(), alertSettingsService.snapshot());
    }

    @PutMapping("/thresholds")
    public PerformanceThresholds updateThresholds(@RequestBody PerformanceThresholdUpdateRequest request,
                                                  Authentication authentication) {
        return alertSettingsService.update(request.validatedThresholds(), authentication.getName());
    }

    @GetMapping("/alerts")
    public List<PerformanceAlertEvent> getAlerts(@RequestParam(defaultValue = "50") int limit) {
        return alertService.recentEvents(limit);
    }

    @GetMapping("/history")
    public PerformanceHistoryResponse getHistory(@RequestParam(defaultValue = "1h") String range) {
        return historyService.history(PerformanceRange.parse(range));
    }

    @GetMapping("/endpoints")
    public List<ApiPerformanceMetric> getEndpoints(
            @RequestParam(defaultValue = "5m") String range,
            @RequestParam(defaultValue = "p95") String sort) {
        return endpointHistoryService.endpoints(PerformanceRange.parse(range), PerformanceEndpointSort.parse(sort));
    }

    public enum PerformanceRange {
        FIVE_MINUTES("5m", 5),
        ONE_HOUR("1h", 60),
        ONE_DAY("24h", 24 * 60);

        private final String label;
        private final int minutes;

        PerformanceRange(String label, int minutes) {
            this.label = label;
            this.minutes = minutes;
        }

        public String label() { return label; }
        public int minutes() { return minutes; }

        public static PerformanceRange parse(String value) {
            for (PerformanceRange range : values()) {
                if (range.label.equalsIgnoreCase(value)) return range;
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "지원하지 않는 성능 조회 범위입니다.");
        }
    }
}
