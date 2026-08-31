package com.hamsetech.hamsetech.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
public class ClockConfig {

    /**
     * 시간을 주입 가능한 값으로 둔다. 잠금 만료처럼 시간에 기대는 로직을
     * Instant.now()로 쓰면 테스트에서 시간을 앞으로 돌릴 방법이 없다.
     */
    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
