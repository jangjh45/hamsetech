package com.hamsetech.hamsetech.admin.performance;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
public class PerformanceEndpointHistoryService {

    private static final int MAX_ENDPOINTS = 15;

    private final JdbcTemplate jdbcTemplate;
    private final int retentionDays;

    public PerformanceEndpointHistoryService(
            JdbcTemplate jdbcTemplate,
            @Value("${admin.performance.history-retention-days:30}") int retentionDays) {
        this.jdbcTemplate = jdbcTemplate;
        this.retentionDays = Math.max(1, retentionDays);
    }

    @Transactional
    public void captureMinute(Instant capturedAt, List<PerformanceEndpointMinute> endpoints) {
        for (PerformanceEndpointMinute endpoint : endpoints) {
            jdbcTemplate.update("""
                            INSERT INTO performance_endpoint_snapshots (
                                captured_at, method, path, request_count, server_errors,
                                total_duration_nanos, p95_latency_ms, p99_latency_ms)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT (captured_at, method, path) DO UPDATE SET
                                request_count = EXCLUDED.request_count,
                                server_errors = EXCLUDED.server_errors,
                                total_duration_nanos = EXCLUDED.total_duration_nanos,
                                p95_latency_ms = EXCLUDED.p95_latency_ms,
                                p99_latency_ms = EXCLUDED.p99_latency_ms
                            """,
                    Timestamp.from(capturedAt), endpoint.method(), endpoint.path(), endpoint.requests(),
                    endpoint.serverErrors(), endpoint.totalDurationNanos(), endpoint.p95LatencyMs(),
                    endpoint.p99LatencyMs());
        }
    }

    @Transactional(readOnly = true)
    public List<ApiPerformanceMetric> endpoints(
            PerformanceMetricsController.PerformanceRange range, PerformanceEndpointSort sort) {
        Instant from = Instant.now().minus(Duration.ofMinutes(range.minutes()));
        String sql = """
                SELECT method, path,
                       SUM(request_count) AS requests,
                       SUM(server_errors) AS server_errors,
                       SUM(server_errors)::double precision * 100 / NULLIF(SUM(request_count), 0) AS error_rate_percent,
                       SUM(total_duration_nanos)::double precision / NULLIF(SUM(request_count), 0) / 1000000 AS average_latency_ms,
                       MAX(p95_latency_ms) AS p95_latency_ms,
                       MAX(p99_latency_ms) AS p99_latency_ms
                FROM performance_endpoint_snapshots
                WHERE captured_at >= ?
                GROUP BY method, path
                ORDER BY
                """ + sort.sqlOrder() + "\nLIMIT " + MAX_ENDPOINTS;
        return jdbcTemplate.query(sql, (rs, rowNum) -> new ApiPerformanceMetric(
                rs.getString("method"), rs.getString("path"), rs.getLong("requests"),
                rs.getLong("server_errors"), rs.getDouble("error_rate_percent"),
                rs.getDouble("average_latency_ms"), nullableDouble(rs, "p95_latency_ms"),
                nullableDouble(rs, "p99_latency_ms")), Timestamp.from(from));
    }

    public int purgeExpired() {
        return jdbcTemplate.update("DELETE FROM performance_endpoint_snapshots WHERE captured_at < ?",
                Timestamp.from(Instant.now().minus(Duration.ofDays(retentionDays))));
    }

    private static Double nullableDouble(java.sql.ResultSet rs, String column) throws java.sql.SQLException {
        double value = rs.getDouble(column);
        return rs.wasNull() ? null : value;
    }
}
