package com.hamsetech.hamsetech.admin.performance;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class PerformanceAlertService {

    private final JdbcTemplate jdbcTemplate;
    private final PerformanceAlertSettingsService settingsService;
    private final PerformanceAlertEvaluator evaluator;
    private final int retentionDays;

    public PerformanceAlertService(JdbcTemplate jdbcTemplate, PerformanceAlertSettingsService settingsService,
                                   PerformanceAlertEvaluator evaluator,
                                   @Value("${admin.performance.alert-history-retention-days:90}") int retentionDays) {
        this.jdbcTemplate = jdbcTemplate;
        this.settingsService = settingsService;
        this.evaluator = evaluator;
        this.retentionDays = Math.max(1, retentionDays);
    }

    @Transactional
    public void recordSnapshot(PerformanceSnapshot snapshot) {
        List<PerformanceAlertCondition> active = evaluator.evaluate(snapshot, settingsService.snapshot());
        Set<String> activeKeys = new HashSet<>();
        List<ActiveAlert> existing = jdbcTemplate.query("""
                        SELECT alert_key, message, observed_value, threshold_value, unit
                        FROM performance_alert_state
                        """,
                (rs, rowNum) -> new ActiveAlert(rs.getString("alert_key"), rs.getString("message"),
                        rs.getDouble("observed_value"), nullableDouble(rs, "threshold_value"), rs.getString("unit")));

        for (PerformanceAlertCondition condition : active) {
            activeKeys.add(condition.alertKey());
            int updated = jdbcTemplate.update("""
                            UPDATE performance_alert_state
                            SET message = ?, observed_value = ?, threshold_value = ?, unit = ?, updated_at = ?
                            WHERE alert_key = ?
                            """,
                    condition.message(), condition.observedValue(), condition.thresholdValue(), condition.unit(),
                    Timestamp.from(snapshot.capturedAt()), condition.alertKey());
            if (updated == 0) {
                int inserted = jdbcTemplate.update("""
                                INSERT INTO performance_alert_state
                                    (alert_key, message, observed_value, threshold_value, unit, opened_at, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                                ON CONFLICT (alert_key) DO NOTHING
                                """,
                        condition.alertKey(), condition.message(), condition.observedValue(), condition.thresholdValue(),
                        condition.unit(), Timestamp.from(snapshot.capturedAt()), Timestamp.from(snapshot.capturedAt()));
                if (inserted == 1) {
                    insertEvent(condition.alertKey(), "TRIGGERED", condition.message(), condition.observedValue(),
                            condition.thresholdValue(), condition.unit(), snapshot.capturedAt());
                } else {
                    jdbcTemplate.update("""
                                    UPDATE performance_alert_state
                                    SET message = ?, observed_value = ?, threshold_value = ?, unit = ?, updated_at = ?
                                    WHERE alert_key = ?
                                    """,
                            condition.message(), condition.observedValue(), condition.thresholdValue(), condition.unit(),
                            Timestamp.from(snapshot.capturedAt()), condition.alertKey());
                }
            }
        }

        for (ActiveAlert previous : existing) {
            if (activeKeys.contains(previous.alertKey())) continue;
            int deleted = jdbcTemplate.update("DELETE FROM performance_alert_state WHERE alert_key = ?", previous.alertKey());
            if (deleted == 1) {
                insertEvent(previous.alertKey(), "RESOLVED", "경고가 해소되었습니다. " + previous.message(), previous.observedValue(),
                        previous.thresholdValue(), previous.unit(), snapshot.capturedAt());
            }
        }
    }

    @Transactional(readOnly = true)
    public List<PerformanceAlertEvent> recentEvents(int requestedLimit) {
        int limit = Math.max(1, Math.min(100, requestedLimit));
        return jdbcTemplate.query("""
                        SELECT id, alert_key, event_type, message, observed_value, threshold_value, unit, occurred_at
                        FROM performance_alert_events
                        ORDER BY occurred_at DESC, id DESC
                        LIMIT ?
                        """,
                (rs, rowNum) -> new PerformanceAlertEvent(
                        rs.getLong("id"), rs.getString("alert_key"), rs.getString("event_type"),
                        rs.getString("message"), rs.getDouble("observed_value"),
                        nullableDouble(rs, "threshold_value"), rs.getString("unit"),
                        rs.getTimestamp("occurred_at").toInstant()), limit);
    }

    @Scheduled(cron = "${admin.performance.alert-history-cleanup-cron:0 0 5 * * *}")
    public void purgeExpiredEvents() {
        jdbcTemplate.update("DELETE FROM performance_alert_events WHERE occurred_at < ?",
                Timestamp.from(Instant.now().minus(Duration.ofDays(retentionDays))));
    }

    private void insertEvent(String key, String eventType, String message, double observedValue,
                             Double thresholdValue, String unit, Instant occurredAt) {
        jdbcTemplate.update("""
                        INSERT INTO performance_alert_events
                            (alert_key, event_type, message, observed_value, threshold_value, unit, occurred_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                key, eventType, message, observedValue, thresholdValue, unit, Timestamp.from(occurredAt));
    }

    private static Double nullableDouble(java.sql.ResultSet rs, String column) throws java.sql.SQLException {
        double value = rs.getDouble(column);
        return rs.wasNull() ? null : value;
    }

    private record ActiveAlert(String alertKey, String message, double observedValue,
                               Double thresholdValue, String unit) {
    }
}
