package com.hamsetech.hamsetech.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig {
    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(@NonNull CorsRegistry registry) {
                registry.addMapping("/api/**")
                        .allowedOriginPatterns(
                                "http://localhost:*",
                                "http://127.0.0.1:*",
                                "http://192.168.*:*",  // 192.168.x.x 대역 허용
                                "http://10.*:*",       // 10.x.x.x 대역 허용 (일반적인 로컬 네트워크)
                                "http://172.16.*:*",   // 172.16.x.x - 172.31.x.x 대역 허용
                                "http://169.254.*:*"   // 169.254.x.x 대역 허용 (링크-로컬)
                        )
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                        .allowedHeaders("*")
                        .allowCredentials(true);
            }
        };
    }
}


