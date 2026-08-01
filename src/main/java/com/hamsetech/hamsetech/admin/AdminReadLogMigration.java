package com.hamsetech.hamsetech.admin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * 기존 admin_logs에 섞여 있던 READ 행을 admin_read_logs로 옮기는 1회성 이관.
 * 옮길 행이 없으면 아무 것도 하지 않으므로 매 기동마다 실행돼도 안전하다.
 */
@Configuration
public class AdminReadLogMigration {

    private static final Logger logger = LoggerFactory.getLogger(AdminReadLogMigration.class);

    @Bean
    @Transactional
    CommandLineRunner moveReadLogsToDedicatedTable(JdbcTemplate jdbc) {
        return args -> {
            try {
                Integer remaining = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM admin_logs WHERE action = 'READ'", Integer.class);
                if (remaining == null || remaining == 0) {
                    return;
                }

                int moved = jdbc.update(
                        "INSERT INTO admin_read_logs (timestamp, admin_username, entity_type, entity_id, details, ip_address) " +
                        "SELECT timestamp, admin_username, entity_type, entity_id, details, ip_address " +
                        "FROM admin_logs WHERE action = 'READ'");
                int deleted = jdbc.update("DELETE FROM admin_logs WHERE action = 'READ'");

                logger.info("Moved {} READ logs from admin_logs to admin_read_logs (deleted {})", moved, deleted);
            } catch (Exception e) {
                // 이관 실패가 기동을 막지 않도록 한다 (다음 기동에서 재시도)
                logger.error("Failed to move READ logs to admin_read_logs", e);
            }
        };
    }
}
