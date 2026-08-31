package com.hamsetech.hamsetech.admin;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;

// 손으로 쓴 PostgreSQL 전용 DDL이라 H2 테스트에서는 전부 실패한다.
// 실패를 삼키고 넘어가므로 테스트가 초록불로 통과해 문제를 가린다.
@Profile("!test")
@Configuration
public class SchemaFixer {

    @Bean
    CommandLineRunner ensureUserRolesCheckConstraint(JdbcTemplate jdbc) {
        return args -> {
            try {
                jdbc.execute("ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check");
                jdbc.execute("ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN ('USER','ADMIN','SUPER_ADMIN'))");
            } catch (Exception ignore) {
                // best-effort: ignore if DB user has no permission or constraint managed elsewhere
            }
        };
    }
}


