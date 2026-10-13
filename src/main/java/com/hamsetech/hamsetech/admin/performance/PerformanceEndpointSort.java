package com.hamsetech.hamsetech.admin.performance;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public enum PerformanceEndpointSort {
    P95("p95", "MAX(p95_latency_ms) DESC NULLS LAST, SUM(request_count) DESC"),
    ERROR_RATE("errors", "SUM(server_errors)::double precision / NULLIF(SUM(request_count), 0) DESC, SUM(request_count) DESC"),
    REQUESTS("requests", "SUM(request_count) DESC, MAX(p95_latency_ms) DESC NULLS LAST");

    private final String label;
    private final String sqlOrder;

    PerformanceEndpointSort(String label, String sqlOrder) {
        this.label = label;
        this.sqlOrder = sqlOrder;
    }

    public String label() { return label; }
    public String sqlOrder() { return sqlOrder; }

    public static PerformanceEndpointSort parse(String value) {
        for (PerformanceEndpointSort sort : values()) {
            if (sort.label.equalsIgnoreCase(value)) return sort;
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "지원하지 않는 느린 API 정렬 기준입니다.");
    }
}
