package com.hamsetech.hamsetech.admin.performance;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class PerformanceAlertProperties {

    private final double p95LatencyMs;
    private final double errorRatePercent;
    private final double heapUsedPercent;
    private final double dbPoolUsedPercent;
    private final double containerMemoryUsedPercent;
    private final double systemCpuPercent;
    private final double systemMemoryUsedPercent;
    private final double uploadStorageFreePercent;

    public PerformanceAlertProperties(
            @Value("${admin.performance.alerts.p95-latency-ms:2000}") double p95LatencyMs,
            @Value("${admin.performance.alerts.error-rate-percent:1}") double errorRatePercent,
            @Value("${admin.performance.alerts.heap-used-percent:85}") double heapUsedPercent,
            @Value("${admin.performance.alerts.db-pool-used-percent:80}") double dbPoolUsedPercent,
            @Value("${admin.performance.alerts.container-memory-used-percent:85}") double containerMemoryUsedPercent,
            @Value("${admin.performance.alerts.system-cpu-percent:90}") double systemCpuPercent,
            @Value("${admin.performance.alerts.system-memory-used-percent:90}") double systemMemoryUsedPercent,
            @Value("${admin.performance.alerts.upload-storage-free-percent:10}") double uploadStorageFreePercent) {
        this.p95LatencyMs = p95LatencyMs;
        this.errorRatePercent = errorRatePercent;
        this.heapUsedPercent = heapUsedPercent;
        this.dbPoolUsedPercent = dbPoolUsedPercent;
        this.containerMemoryUsedPercent = containerMemoryUsedPercent;
        this.systemCpuPercent = systemCpuPercent;
        this.systemMemoryUsedPercent = systemMemoryUsedPercent;
        this.uploadStorageFreePercent = uploadStorageFreePercent;
    }

    public PerformanceThresholds snapshot() {
        return new PerformanceThresholds(p95LatencyMs, errorRatePercent, heapUsedPercent,
                dbPoolUsedPercent, containerMemoryUsedPercent, systemCpuPercent,
                systemMemoryUsedPercent, uploadStorageFreePercent);
    }
}
