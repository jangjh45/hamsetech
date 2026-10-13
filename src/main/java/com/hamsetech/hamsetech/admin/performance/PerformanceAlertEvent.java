package com.hamsetech.hamsetech.admin.performance;

import java.time.Instant;

public record PerformanceAlertEvent(
        long id,
        String alertKey,
        String eventType,
        String message,
        double observedValue,
        Double thresholdValue,
        String unit,
        Instant occurredAt) {
}
