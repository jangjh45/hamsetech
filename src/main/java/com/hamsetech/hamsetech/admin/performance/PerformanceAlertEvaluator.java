package com.hamsetech.hamsetech.admin.performance;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Component
public class PerformanceAlertEvaluator {

    public List<PerformanceAlertCondition> evaluate(PerformanceSnapshot snapshot, PerformanceThresholds thresholds) {
        List<PerformanceAlertCondition> alerts = new ArrayList<>();
        if (snapshot.requestsLast60Seconds() > 0 && snapshot.p95LatencyMs() != null
                && snapshot.p95LatencyMs() >= thresholds.p95LatencyMs()) {
            alerts.add(new PerformanceAlertCondition("p95_latency",
                    "API p95 응답시간이 " + number(thresholds.p95LatencyMs()) + "ms 기준을 넘었습니다.",
                    snapshot.p95LatencyMs(), thresholds.p95LatencyMs(), "ms"));
        }
        if (snapshot.requestsLast60Seconds() > 0 && snapshot.errorRatePercent() >= thresholds.errorRatePercent()) {
            alerts.add(new PerformanceAlertCondition("error_rate",
                    "5xx 오류율이 " + number(thresholds.errorRatePercent()) + "% 기준을 넘었습니다.",
                    snapshot.errorRatePercent(), thresholds.errorRatePercent(), "%"));
        }

        addRatioAlert(alerts, "heap_used", "JVM 힙 사용률", snapshot.jvmHeapUsedBytes(),
                snapshot.jvmHeapMaxBytes(), thresholds.heapUsedPercent());

        if (snapshot.dbConnectionsPending() != null && snapshot.dbConnectionsPending() > 0) {
            alerts.add(new PerformanceAlertCondition("db_pending", "DB 연결을 기다리는 요청이 있습니다.",
                    snapshot.dbConnectionsPending(), null, "개"));
        } else {
            addRatioAlert(alerts, "db_pool_used", "DB 연결 풀 사용률", snapshot.dbConnectionsActive(),
                    snapshot.dbConnectionsMax(), thresholds.dbPoolUsedPercent());
        }

        addRatioAlert(alerts, "container_memory", "컨테이너 메모리 사용률", snapshot.containerMemoryUsedBytes(),
                snapshot.containerMemoryMaxBytes(), thresholds.containerMemoryUsedPercent());
        addThresholdAlert(alerts, "system_cpu", "시스템 CPU 사용률", snapshot.systemCpuPercent(),
                thresholds.systemCpuPercent(), "%");
        addRatioAlert(alerts, "system_memory", "NAS 시스템 메모리 사용률", snapshot.systemMemoryUsedBytes(),
                snapshot.systemMemoryTotalBytes(), thresholds.systemMemoryUsedPercent());

        Double uploadFreePercent = ratioPercent(snapshot.uploadStorageUsableBytes(), snapshot.uploadStorageTotalBytes());
        if (uploadFreePercent != null && uploadFreePercent < thresholds.uploadStorageFreePercent()) {
            alerts.add(new PerformanceAlertCondition("upload_storage_free",
                    "첨부 저장소 여유 공간이 " + number(thresholds.uploadStorageFreePercent()) + "% 미만입니다.",
                    uploadFreePercent, thresholds.uploadStorageFreePercent(), "%"));
        }
        return alerts;
    }

    private static void addRatioAlert(List<PerformanceAlertCondition> alerts, String key, String label,
                                      Double used, Double max, double threshold) {
        Double percent = ratioPercent(used, max);
        addThresholdAlert(alerts, key, label, percent, threshold, "%");
    }

    private static void addThresholdAlert(List<PerformanceAlertCondition> alerts, String key, String label,
                                          Double observed, double threshold, String unit) {
        if (observed != null && observed >= threshold) {
            alerts.add(new PerformanceAlertCondition(key,
                    label + "이 " + number(threshold) + unit + " 기준을 넘었습니다.", observed, threshold, unit));
        }
    }

    private static Double ratioPercent(Double used, Double max) {
        if (used == null || max == null || !Double.isFinite(used) || !Double.isFinite(max) || max <= 0) return null;
        return Math.max(0, Math.min(100, used / max * 100));
    }

    private static String number(double value) {
        return BigDecimal.valueOf(value).stripTrailingZeros().toPlainString();
    }
}
