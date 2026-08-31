package com.hamsetech.hamsetech.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig {

    private final String[] allowedOriginPatterns;

    public CorsConfig(@Value("${app.cors.allowed-origins:http://localhost:*,http://127.0.0.1:*}") String allowedOrigins) {
        this.allowedOriginPatterns = java.util.Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toArray(String[]::new);
    }

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(@NonNull CorsRegistry registry) {
                registry.addMapping("/api/**")
                        // 로컬 개발 서버의 포트는 매번 달라질 수 있으므로 localhost만
                        // 포트 와일드카드를 허용한다. LAN 주소는 설정에 정확히 추가해야 한다.
                        .allowedOriginPatterns(allowedOriginPatterns)
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                        .allowedHeaders("*")
                        .allowCredentials(true);
            }
        };
    }
}


