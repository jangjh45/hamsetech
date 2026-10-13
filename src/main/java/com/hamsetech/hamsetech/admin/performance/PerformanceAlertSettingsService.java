package com.hamsetech.hamsetech.admin.performance;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PerformanceAlertSettingsService {

    private final JdbcTemplate jdbcTemplate;
    private final PerformanceAlertProperties defaults;
    private volatile PerformanceThresholds h2Fallback;
    private volatile boolean initialized;

    public PerformanceAlertSettingsService(JdbcTemplate jdbcTemplate, PerformanceAlertProperties defaults) {
        this.jdbcTemplate = jdbcTemplate;
        this.defaults = defaults;
    }

    private synchronized void ensureInitialized() {
        if (initialized) return;
        boolean h2 = Boolean.TRUE.equals(jdbcTemplate.execute((ConnectionCallback<Boolean>) connection ->
                connection.getMetaData().getDatabaseProductName().equalsIgnoreCase("H2")));
        if (h2) {
            // The H2 application-context smoke test intentionally disables Flyway.
            h2Fallback = defaults.snapshot();
            initialized = true;
            return;
        }
        PerformanceThresholds thresholds = defaults.snapshot();
        jdbcTemplate.update("""
                INSERT INTO performance_alert_settings (
                    setting_id, p95_latency_ms, error_rate_percent, heap_used_percent,
                    db_pool_used_percent, container_memory_used_percent, system_cpu_percent,
                    system_memory_used_percent, upload_storage_free_percent, updated_at, updated_by)
                VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'system')
                ON CONFLICT (setting_id) DO NOTHING
                """,
                thresholds.p95LatencyMs(), thresholds.errorRatePercent(), thresholds.heapUsedPercent(),
                thresholds.dbPoolUsedPercent(), thresholds.containerMemoryUsedPercent(),
                thresholds.systemCpuPercent(), thresholds.systemMemoryUsedPercent(),
                thresholds.uploadStorageFreePercent());
        initialized = true;
    }

    public PerformanceThresholds snapshot() {
        ensureInitialized();
        if (h2Fallback != null) return h2Fallback;
        return jdbcTemplate.queryForObject("""
                        SELECT p95_latency_ms, error_rate_percent, heap_used_percent,
                               db_pool_used_percent, container_memory_used_percent, system_cpu_percent,
                               system_memory_used_percent, upload_storage_free_percent
                        FROM performance_alert_settings WHERE setting_id = 1
                        """,
                (rs, rowNum) -> new PerformanceThresholds(
                        rs.getDouble("p95_latency_ms"), rs.getDouble("error_rate_percent"),
                        rs.getDouble("heap_used_percent"), rs.getDouble("db_pool_used_percent"),
                        rs.getDouble("container_memory_used_percent"), rs.getDouble("system_cpu_percent"),
                        rs.getDouble("system_memory_used_percent"), rs.getDouble("upload_storage_free_percent")));
    }

    @Transactional
    public PerformanceThresholds update(PerformanceThresholds thresholds, String updatedBy) {
        ensureInitialized();
        if (h2Fallback != null) {
            h2Fallback = thresholds;
            return thresholds;
        }
        jdbcTemplate.update("""
                        UPDATE performance_alert_settings
                        SET p95_latency_ms = ?, error_rate_percent = ?, heap_used_percent = ?,
                            db_pool_used_percent = ?, container_memory_used_percent = ?, system_cpu_percent = ?,
                            system_memory_used_percent = ?, upload_storage_free_percent = ?,
                            updated_at = CURRENT_TIMESTAMP, updated_by = ?
                        WHERE setting_id = 1
                        """,
                thresholds.p95LatencyMs(), thresholds.errorRatePercent(), thresholds.heapUsedPercent(),
                thresholds.dbPoolUsedPercent(), thresholds.containerMemoryUsedPercent(),
                thresholds.systemCpuPercent(), thresholds.systemMemoryUsedPercent(),
                thresholds.uploadStorageFreePercent(), safeUsername(updatedBy));
        return thresholds;
    }

    private static String safeUsername(String username) {
        if (username == null || username.isBlank()) return "unknown";
        return username.length() <= 255 ? username : username.substring(0, 255);
    }
}
