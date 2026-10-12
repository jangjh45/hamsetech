package com.hamsetech.hamsetech.admin.performance;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class PerformanceMetricsConfiguration {

    @Bean
    PerformanceMetricsFilter performanceMetricsFilter(PerformanceMetricsService metricsService) {
        return new PerformanceMetricsFilter(metricsService);
    }
}
