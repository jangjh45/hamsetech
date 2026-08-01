package com.hamsetech.hamsetech.admin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/**
 * 보존기간이 지난 조회 로그를 매일 새벽에 정리한다.
 * 보존기간은 admin.read-log.retention-days 로 조정할 수 있고, 0 이하면 정리하지 않는다.
 */
@Component
@EnableScheduling
public class AdminReadLogRetention {

    private static final Logger logger = LoggerFactory.getLogger(AdminReadLogRetention.class);

    private final AdminReadLogRepository adminReadLogRepository;
    private final int retentionDays;

    public AdminReadLogRetention(AdminReadLogRepository adminReadLogRepository,
                                 @Value("${admin.read-log.retention-days:90}") int retentionDays) {
        this.adminReadLogRepository = adminReadLogRepository;
        this.retentionDays = retentionDays;
    }

    @Scheduled(cron = "${admin.read-log.cleanup-cron:0 30 4 * * *}")
    @Transactional
    public void purgeExpiredReadLogs() {
        if (retentionDays <= 0) {
            return;
        }
        Instant cutoff = Instant.now().minus(Duration.ofDays(retentionDays));
        int deleted = adminReadLogRepository.deleteOlderThan(cutoff);
        if (deleted > 0) {
            logger.info("Purged {} read logs older than {} days", deleted, retentionDays);
        }
    }
}
