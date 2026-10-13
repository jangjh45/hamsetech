package com.hamsetech.hamsetech.admin.performance;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PerformanceThresholdUpdateRequestTest {

    @Test
    void validatesAndPreservesEveryThreshold() {
        var request = new PerformanceThresholdUpdateRequest(1250.5, 1.5, 85.5, 80.5,
                86.5, 90.5, 91.5, 10.5);

        assertThat(request.validatedThresholds()).isEqualTo(new PerformanceThresholds(
                1250.5, 1.5, 85.5, 80.5, 86.5, 90.5, 91.5, 10.5));
    }

    @Test
    void rejectsMissingAndOutOfRangeThresholds() {
        assertThatThrownBy(() -> new PerformanceThresholdUpdateRequest(
                null, 1.0, 85.0, 80.0, 85.0, 90.0, 90.0, 10.0).validatedThresholds())
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new PerformanceThresholdUpdateRequest(
                0.0, 1.0, 85.0, 80.0, 85.0, 90.0, 90.0, 10.0).validatedThresholds())
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new PerformanceThresholdUpdateRequest(
                2000.0, 101.0, 85.0, 80.0, 85.0, 90.0, 90.0, 10.0).validatedThresholds())
                .isInstanceOf(IllegalArgumentException.class);
    }
}
