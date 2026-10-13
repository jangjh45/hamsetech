package com.hamsetech.hamsetech.admin.performance;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/** Records API traffic while excluding the polling endpoint so the dashboard does not measure itself. */
public class PerformanceMetricsFilter extends OncePerRequestFilter {

    private static final String PERFORMANCE_ENDPOINT = "/api/admin/performance";

    private final PerformanceMetricsService metricsService;

    public PerformanceMetricsFilter(PerformanceMetricsService metricsService) {
        this.metricsService = metricsService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !path.startsWith("/api/")
                || path.equals(PERFORMANCE_ENDPOINT)
                || path.startsWith(PERFORMANCE_ENDPOINT + "/")
                || "OPTIONS".equalsIgnoreCase(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long startedAt = System.nanoTime();
        try {
            chain.doFilter(request, response);
        } catch (ServletException | IOException | RuntimeException | Error exception) {
            metricsService.recordRequest(System.nanoTime() - startedAt, 500,
                    request.getMethod(), request.getRequestURI());
            throw exception;
        }
        metricsService.recordRequest(System.nanoTime() - startedAt, response.getStatus(),
                request.getMethod(), request.getRequestURI());
    }
}
