package com.hamsetech.hamsetech.user;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 승인제 도입 전에 만들어진 계정을 APPROVED로 올린다.
 *
 * ddl-auto=update가 users.status 컬럼을 추가해 주지만 기존 행은 전부 NULL이 되고,
 * NULL은 미승인으로 취급되므로 이 백필이 없으면 기존 사용자 전원이 로그인하지 못한다.
 * 백필 대상이 없으면 아무 것도 하지 않아 매 기동마다 실행돼도 안전하다.
 */
@Configuration
public class UserStatusMigration {

    private static final Logger logger = LoggerFactory.getLogger(UserStatusMigration.class);

    @Bean
    @Order(0)
    CommandLineRunner approveExistingUsers(JdbcTemplate jdbc) {
        return args -> {
            try {
                // Hibernate가 이미 만들었어도 무해하고, 순서가 뒤바뀌어도 백필이 돌도록 한다
                jdbc.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20)");

                int approved = jdbc.update(
                        "UPDATE users SET status = 'APPROVED' WHERE status IS NULL");
                if (approved > 0) {
                    logger.info("Backfilled {} pre-existing user(s) to status=APPROVED", approved);
                }
            } catch (Exception e) {
                // 기동 자체를 막지는 않는다. 이 경우에도 AdminInitializer가 관리자 계정을
                // APPROVED로 유지하므로 관리자 화면에서 수동으로 승인할 수 있다.
                logger.error("Failed to backfill users.status — 기존 계정이 로그인하지 못할 수 있습니다", e);
            }
        };
    }
}


