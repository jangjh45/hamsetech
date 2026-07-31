package com.hamsetech.hamsetech.calendar;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
public class CalendarSchemaFixer {

    /**
     * scope 도입 이전에 등록된 일정을 COMPANY로 채운다.
     *
     * 그때는 전 사용자가 같은 목록을 봤으므로, 보이던 것을 그대로 보이게 두는 쪽이
     * 맞는 마이그레이션이다. PRIVATE로 채우면 주인 없는 일정이 전부 사라진다.
     */
    @Bean
    CommandLineRunner backfillCalendarEventScope(JdbcTemplate jdbc) {
        return args -> {
            try {
                jdbc.update("UPDATE calendar_events SET scope = 'COMPANY' WHERE scope IS NULL");
            } catch (Exception ignore) {
                // best-effort: 컬럼이 아직 없거나 권한이 없으면 무시한다.
                // 조회 쿼리가 scope IS NULL을 사내 일정으로 취급하므로 실패해도 안전하다.
            }
        };
    }
}
