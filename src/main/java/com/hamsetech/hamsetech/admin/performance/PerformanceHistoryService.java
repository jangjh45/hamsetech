package com.hamsetech.hamsetech.admin.performance;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.sql.Types;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class PerformanceHistoryService {

    private static final Logger logger = LoggerFactory.getLogger(PerformanceHistoryService.class);
    private final JdbcTemplate jdbcTemplate;
    private final PerformanceMetricsService metricsService;
    private final PerformanceAlertService alertService;
    private final PerformanceEndpointHistoryService endpointHistoryService;
    private final int retentionDays;

    public PerformanceHistoryService(
            JdbcTemplate jdbcTemplate,
            PerformanceMetricsService metricsService,
            PerformanceAlertService alertService,
            PerformanceEndpointHistoryService endpointHistoryService,
            @Value("${admin.performance.history-retention-days:30}") int retentionDays) {
        this.jdbcTemplate = jdbcTemplate;
        this.metricsService = metricsService;
        this.alertService = alertService;
        this.endpointHistoryService = endpointHistoryService;
        this.retentionDays = Math.max(1, retentionDays);
    }

    @Scheduled(cron = "${admin.performance.snapshot-cron:0 * * * * *}")
    public void captureMinute() {
        PerformanceSnapshot snapshot = metricsService.snapshot();
        Instant capturedAt = snapshot.capturedAt().truncatedTo(ChronoUnit.MINUTES);
        jdbcTemplate.update(connection -> {
            var statement = connection.prepareStatement("""
                    INSERT INTO performance_snapshots (
                        captured_at, requests_per_second, error_rate_percent, average_latency_ms,
                        p95_latency_ms, p99_latency_ms, jvm_heap_used_bytes, jvm_heap_max_bytes,
                        db_connections_active, db_connections_max, jvm_non_heap_used_bytes,
                        jvm_non_heap_max_bytes, process_cpu_percent, system_cpu_percent,
                        container_memory_used_bytes, container_memory_max_bytes,
                        system_memory_used_bytes, system_memory_total_bytes,
                        db_connections_idle, db_connections_pending,
                        upload_storage_usable_bytes, upload_storage_total_bytes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (captured_at) DO UPDATE SET
                        requests_per_second = EXCLUDED.requests_per_second,
                        error_rate_percent = EXCLUDED.error_rate_percent,
                        average_latency_ms = EXCLUDED.average_latency_ms,
                        p95_latency_ms = EXCLUDED.p95_latency_ms,
                        p99_latency_ms = EXCLUDED.p99_latency_ms,
                        jvm_heap_used_bytes = EXCLUDED.jvm_heap_used_bytes,
                        jvm_heap_max_bytes = EXCLUDED.jvm_heap_max_bytes,
                        db_connections_active = EXCLUDED.db_connections_active,
                        db_connections_max = EXCLUDED.db_connections_max,
                        jvm_non_heap_used_bytes = EXCLUDED.jvm_non_heap_used_bytes,
                        jvm_non_heap_max_bytes = EXCLUDED.jvm_non_heap_max_bytes,
                        process_cpu_percent = EXCLUDED.process_cpu_percent,
                        system_cpu_percent = EXCLUDED.system_cpu_percent,
                        container_memory_used_bytes = EXCLUDED.container_memory_used_bytes,
                        container_memory_max_bytes = EXCLUDED.container_memory_max_bytes,
                        system_memory_used_bytes = EXCLUDED.system_memory_used_bytes,
                        system_memory_total_bytes = EXCLUDED.system_memory_total_bytes,
                        db_connections_idle = EXCLUDED.db_connections_idle,
                        db_connections_pending = EXCLUDED.db_connections_pending,
                        upload_storage_usable_bytes = EXCLUDED.upload_storage_usable_bytes,
                        upload_storage_total_bytes = EXCLUDED.upload_storage_total_bytes
                    """);
            int index = 1;
            statement.setTimestamp(index++, Timestamp.from(capturedAt));
            // 장기 추이에는 5초 순간값 대신 직전 60초 평균을 저장한다.
            statement.setDouble(index++, snapshot.requestsLast60Seconds() / 60.0);
            statement.setDouble(index++, snapshot.errorRatePercent());
            setNullableDouble(statement, index++, snapshot.averageLatencyMs());
            setNullableDouble(statement, index++, snapshot.p95LatencyMs());
            setNullableDouble(statement, index++, snapshot.p99LatencyMs());
            setNullableDouble(statement, index++, snapshot.jvmHeapUsedBytes());
            setNullableDouble(statement, index++, snapshot.jvmHeapMaxBytes());
            setNullableDouble(statement, index++, snapshot.dbConnectionsActive());
            setNullableDouble(statement, index++, snapshot.dbConnectionsMax());
            setNullableDouble(statement, index++, snapshot.jvmNonHeapUsedBytes());
            setNullableDouble(statement, index++, snapshot.jvmNonHeapMaxBytes());
            setNullableDouble(statement, index++, snapshot.processCpuPercent());
            setNullableDouble(statement, index++, snapshot.systemCpuPercent());
            setNullableDouble(statement, index++, snapshot.containerMemoryUsedBytes());
            setNullableDouble(statement, index++, snapshot.containerMemoryMaxBytes());
            setNullableDouble(statement, index++, snapshot.systemMemoryUsedBytes());
            setNullableDouble(statement, index++, snapshot.systemMemoryTotalBytes());
            setNullableDouble(statement, index++, snapshot.dbConnectionsIdle());
            setNullableDouble(statement, index++, snapshot.dbConnectionsPending());
            setNullableDouble(statement, index++, snapshot.uploadStorageUsableBytes());
            setNullableDouble(statement, index, snapshot.uploadStorageTotalBytes());
            return statement;
        });
        endpointHistoryService.captureMinute(capturedAt,
                metricsService.endpointMinuteSnapshotAt(snapshot.capturedAt().getEpochSecond()));
        alertService.recordSnapshot(snapshot);
    }

    public PerformanceHistoryResponse history(PerformanceMetricsController.PerformanceRange range) {
        Instant now = Instant.now();
        Instant from = now.minus(Duration.ofMinutes(range.minutes()));
        List<PerformanceHistoryPoint> points = jdbcTemplate.query("""
                        SELECT captured_at, requests_per_second, error_rate_percent, p95_latency_ms,
                               jvm_heap_used_bytes, jvm_heap_max_bytes, db_connections_active,
                               db_connections_max, system_cpu_percent, container_memory_used_bytes,
                               container_memory_max_bytes, system_memory_used_bytes, system_memory_total_bytes
                        FROM performance_snapshots
                        WHERE captured_at >= ?
                        ORDER BY captured_at
                        """,
                (rs, rowNum) -> new PerformanceHistoryPoint(
                        rs.getTimestamp("captured_at").toInstant(),
                        rs.getDouble("requests_per_second"),
                        rs.getDouble("error_rate_percent"),
                        nullableDouble(rs, "p95_latency_ms"),
                        nullableDouble(rs, "jvm_heap_used_bytes"),
                        nullableDouble(rs, "jvm_heap_max_bytes"),
                        nullableDouble(rs, "db_connections_active"),
                        nullableDouble(rs, "db_connections_max"),
                        nullableDouble(rs, "system_cpu_percent"),
                        nullableDouble(rs, "container_memory_used_bytes"),
                        nullableDouble(rs, "container_memory_max_bytes"),
                        nullableDouble(rs, "system_memory_used_bytes"),
                        nullableDouble(rs, "system_memory_total_bytes")),
                Timestamp.from(from));
        return new PerformanceHistoryResponse(range.label(), now,
                points.isEmpty() ? null : points.get(0).capturedAt(), retentionDays, points);
    }

    @Scheduled(cron = "${admin.performance.cleanup-cron:0 45 4 * * *}")
    public void purgeExpired() {
        int deleted = jdbcTemplate.update("DELETE FROM performance_snapshots WHERE captured_at < ?",
                Timestamp.from(Instant.now().minus(Duration.ofDays(retentionDays))));
        int endpointRowsDeleted = endpointHistoryService.purgeExpired();
        if (deleted > 0 || endpointRowsDeleted > 0) {
            logger.info("Purged {} performance snapshots and {} endpoint snapshots older than {} days",
                    deleted, endpointRowsDeleted, retentionDays);
        }
    }

    private static void setNullableDouble(java.sql.PreparedStatement statement, int index, Double value)
            throws java.sql.SQLException {
        if (value == null || !Double.isFinite(value)) statement.setNull(index, Types.DOUBLE);
        else statement.setDouble(index, value);
    }

    private static Double nullableDouble(java.sql.ResultSet rs, String column) throws java.sql.SQLException {
        double value = rs.getDouble(column);
        return rs.wasNull() ? null : value;
    }
}
