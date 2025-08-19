package com.hamsetech.hamsetech.admin;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

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


