package com.hamsetech.hamsetech.user;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

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

    /**
     * users.status의 CHECK 제약을 현재 UserStatus 값 전체로 맞춘다.
     *
     * Hibernate는 @Enumerated(STRING) 컬럼을 만들 때 그 시점의 enum 값만 허용하는 CHECK 제약을
     * 함께 만드는데, ddl-auto=update는 이미 있는 제약을 절대 손대지 않는다. 그래서 enum에 값을
     * 추가해도 DB는 예전 목록만 허용하고, 새 값을 저장하려는 순간 제약 위반으로 실패한다.
     * (WITHDRAW_REQUESTED / WITHDRAWN 추가 시 실제로 겪은 문제다.)
     *
     * 제약 이름은 Hibernate 버전에 따라 다를 수 있어 이름을 가정하지 않고 users의 CHECK 제약 중
     * status 값 목록을 담고 있는 것을 찾아 지운 뒤 다시 만든다. 매 기동마다 돌아도 안전하다.
     */
    @Bean
    @Order(1)
    CommandLineRunner syncUserStatusCheckConstraint(JdbcTemplate jdbc) {
        return args -> {
            String allowed = Arrays.stream(UserStatus.values())
                    .map(s -> "'" + s.name() + "'")
                    .collect(Collectors.joining(", "));
            try {
                List<String> stale = jdbc.queryForList(
                        "SELECT conname FROM pg_constraint " +
                        "WHERE conrelid = 'users'::regclass AND contype = 'c' " +
                        "AND pg_get_constraintdef(oid) LIKE '%status%'",
                        String.class);
                for (String name : stale) {
                    jdbc.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS \"" + name + "\"");
                }
                jdbc.execute("ALTER TABLE users ADD CONSTRAINT users_status_check "
                        + "CHECK (status IS NULL OR status IN (" + allowed + "))");
                if (!stale.isEmpty()) {
                    logger.info("Rebuilt users.status check constraint with values: {}", allowed);
                }
            } catch (Exception e) {
                // 제약이 예전 목록으로 남으면 탈퇴 처리가 실패한다. 기동은 막지 않되 크게 남긴다.
                logger.error("Failed to sync users.status check constraint — 탈퇴 처리가 실패할 수 있습니다", e);
            }
        };
    }
}


