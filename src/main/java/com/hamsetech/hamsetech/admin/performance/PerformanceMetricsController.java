package com.hamsetech.hamsetech.admin.performance;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/performance")
public class PerformanceMetricsController {

    private final PerformanceMetricsService metricsService;
    private final PerformanceHistoryService historyService;
    private final PerformanceAlertProperties alertProperties;

    public PerformanceMetricsController(PerformanceMetricsService metricsService,
                                        PerformanceHistoryService historyService,
                                        PerformanceAlertProperties alertProperties) {
        this.metricsService = metricsService;
        this.historyService = historyService;
        this.alertProperties = alertProperties;
    }

    @GetMapping
    public PerformanceDashboardSnapshot getSnapshot() {
        return new PerformanceDashboardSnapshot(
                metricsService.snapshot(), metricsService.endpointSnapshot(), alertProperties.snapshot());
    }

    @GetMapping("/history")
    public PerformanceHistoryResponse getHistory(@RequestParam(defaultValue = "1h") String range) {
        return historyService.history(PerformanceRange.parse(range));
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
