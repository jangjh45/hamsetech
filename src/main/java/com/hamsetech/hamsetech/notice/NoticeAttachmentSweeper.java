package com.hamsetech.hamsetech.notice;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

/**
 * 글에 붙지 못한 첨부를 치운다.
 *
 * 파일은 글을 저장하기 전에 먼저 올라가므로, 쓰다 만 채 화면을 벗어나면 디스크에만
 * 남는다. 트랜잭션이 롤백돼 디스크에 남은 파일도 여기서 함께 회수된다.
 * (@EnableScheduling은 AdminReadLogRetention 쪽에서 이미 켜져 있다.)
 */
@Component
public class NoticeAttachmentSweeper {

    private static final Logger logger = LoggerFactory.getLogger(NoticeAttachmentSweeper.class);

    private final NoticeAttachmentService attachmentService;
    private final UploadProperties properties;

    public NoticeAttachmentSweeper(NoticeAttachmentService attachmentService,
                                   UploadProperties properties) {
        this.attachmentService = attachmentService;
        this.properties = properties;
    }

    @Scheduled(cron = "${app.upload.orphan-cleanup-cron:0 15 4 * * *}")
    public void purgeOrphans() {
        int hours = properties.getOrphanRetentionHours();
        if (hours <= 0) {
            return; // 0 이하면 정리하지 않는다 (조회 로그 보존 설정과 같은 규칙)
        }
        try {
            attachmentService.purgeOrphans(Instant.now().minus(Duration.ofHours(hours)));
        } catch (Exception e) {
            logger.error("Failed to purge orphan notice attachments", e);
        }
    }
}
