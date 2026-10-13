package com.hamsetech.hamsetech.admin.performance;

/** Request body for updating all performance alert thresholds at once. */
public record PerformanceThresholdUpdateRequest(
        Double p95LatencyMs,
        Double errorRatePercent,
        Double heapUsedPercent,
        Double dbPoolUsedPercent,
        Double containerMemoryUsedPercent,
        Double systemCpuPercent,
        Double systemMemoryUsedPercent,
        Double uploadStorageFreePercent) {

    public PerformanceThresholds validatedThresholds() {
        return new PerformanceThresholds(
                requiredRange("p95 응답시간", p95LatencyMs, 1, 3_600_000),
                requiredRange("오류율", errorRatePercent, 0, 100),
                requiredRange("JVM 힙 사용률", heapUsedPercent, 0, 100),
                requiredRange("DB 연결 풀 사용률", dbPoolUsedPercent, 0, 100),
                requiredRange("컨테이너 메모리 사용률", containerMemoryUsedPercent, 0, 100),
                requiredRange("시스템 CPU 사용률", systemCpuPercent, 0, 100),
                requiredRange("시스템 메모리 사용률", systemMemoryUsedPercent, 0, 100),
                requiredRange("첨부 저장소 여유 공간", uploadStorageFreePercent, 0, 100));
    }

    private static double requiredRange(String label, Double value, double minimum, double maximum) {
        if (value == null || !Double.isFinite(value) || value < minimum || value > maximum) {
            throw new IllegalArgumentException(label + " 기준은 " + minimum + "~" + maximum + " 범위여야 합니다.");
        }
        return value;
    }
}
