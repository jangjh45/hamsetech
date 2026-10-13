package com.hamsetech.hamsetech.admin.performance;

public record PerformanceAlertCondition(
        String alertKey,
        String message,
        double observedValue,
        Double thresholdValue,
        String unit) {
}
