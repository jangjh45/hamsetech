package com.hamsetech.hamsetech.admin.performance;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PerformanceMetricsServiceTest {

    @Test
    void snapshotAggregatesRecentApiRequestsAndServerErrors() {
        var registry = new SimpleMeterRegistry();
        var service = new PerformanceMetricsService(registry, "./uploads");
        service.recordRequestAt(1_000, 10_000_000, 200);
        service.recordRequestAt(1_058, 20_000_000, 503);
        service.recordRequestAt(1_060, 30_000_000, 200);

        PerformanceSnapshot snapshot = service.snapshotAt(1_060);

        assertThat(snapshot.requestsLast5Seconds()).isEqualTo(2);
        assertThat(snapshot.requestsLast60Seconds()).isEqualTo(2);
        assertThat(snapshot.serverErrorsLast60Seconds()).isEqualTo(1);
        assertThat(snapshot.requestsPerSecond()).isEqualTo(0.4);
        assertThat(snapshot.errorRatePercent()).isEqualTo(50.0);
        assertThat(snapshot.averageLatencyMs()).isEqualTo(25.0);
        assertThat(snapshot.p50LatencyMs()).isNotNull();
        assertThat(snapshot.p95LatencyMs()).isNotNull();
        assertThat(snapshot.p99LatencyMs()).isNotNull();
        assertThat(snapshot.jvmHeapUsedBytes()).isNull();
        assertThat(snapshot.dbConnectionsActive()).isNull();
        assertThat(service.endpointSnapshotAt(1_060)).extracting(ApiPerformanceMetric::requests).containsExactly(2L);
    }

    @Test
    void snapshotIgnoresRequestsOutsideTheSixtySecondWindow() {
        var service = new PerformanceMetricsService(new SimpleMeterRegistry(), "./uploads");
        service.recordRequestAt(1_000, 1_000_000, 500);

        PerformanceSnapshot snapshot = service.snapshotAt(1_059);

        assertThat(snapshot.requestsLast60Seconds()).isEqualTo(1);
        assertThat(snapshot.serverErrorsLast60Seconds()).isEqualTo(1);

        assertThat(service.snapshotAt(1_060).requestsLast60Seconds()).isZero();
    }

    @Test
    void endpointMetricsAggregateNormalizedPathsWithoutRetainingIdentifiers() {
        var service = new PerformanceMetricsService(new SimpleMeterRegistry(), "./uploads");
        service.recordRequestAt(1_000, 10_000_000, 200, "GET", "/api/notices/12345?private=ignored");
        service.recordRequestAt(1_001, 30_000_000, 500, "GET", "/api/notices/67890");
        service.recordRequestAt(1_002, 5_000_000, 200, "GET", "/api/notices/12345/comments/8");

        var endpoints = service.endpointSnapshotAt(1_002);

        assertThat(endpoints).hasSize(2);
        assertThat(endpoints.get(0).path()).isEqualTo("/api/notices/{id}");
        assertThat(endpoints.get(0).requests()).isEqualTo(2);
        assertThat(endpoints.get(0).serverErrors()).isEqualTo(1);
        assertThat(endpoints).noneMatch(metric -> metric.path().contains("12345") || metric.path().contains("67890"));
    }
}
