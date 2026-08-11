package com.hamsetech.hamsetech.notice;

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
 * 공지 테이블에 뒤늦게 붙은 컬럼들을 채우고 제약을 맞춘다.
 *
 * ddl-auto=update가 컬럼 자체는 만들어 주지만 기존 행은 전부 NULL로 남고,
 * NOT NULL이나 DEFAULT도 걸어 주지 않는다. UserStatusMigration과 같은 방식으로
 * 백필한 뒤 제약을 세운다. 백필할 것이 없으면 아무 일도 하지 않아 매 기동 반복돼도 안전하다.
 */
@Configuration
public class NoticeSchemaFixer {

    private static final Logger logger = LoggerFactory.getLogger(NoticeSchemaFixer.class);

    @Bean
    @Order(10)
    CommandLineRunner fixNoticeSchema(JdbcTemplate jdbc) {
        return args -> {
            try {
                // Hibernate가 이미 만들었어도 무해하고, 순서가 뒤바뀌어도 백필이 돌도록 한다
                jdbc.execute("ALTER TABLE notices ADD COLUMN IF NOT EXISTS pinned boolean");
                jdbc.execute("ALTER TABLE notices ADD COLUMN IF NOT EXISTS view_count bigint");
                jdbc.execute("ALTER TABLE notices ADD COLUMN IF NOT EXISTS category varchar(30)");
                jdbc.execute("ALTER TABLE notices ADD COLUMN IF NOT EXISTS content_format varchar(10)");
                jdbc.execute("ALTER TABLE notices ADD COLUMN IF NOT EXISTS content_text text");

                jdbc.update("UPDATE notices SET pinned = false WHERE pinned IS NULL");
                jdbc.update("UPDATE notices SET view_count = 0 WHERE view_count IS NULL");
                jdbc.update("UPDATE notices SET category = 'GENERAL' WHERE category IS NULL");

                // 이 한 줄이 이 마이그레이션의 핵심이다.
                // 기존 글은 줄바꿈이 \n인 평문인데, 컬럼 기본값(HTML)을 그대로 두면
                // 상세 화면이 HTML로 그려 문단이 통째로 한 줄이 된다.
                int legacy = jdbc.update(
                        "UPDATE notices SET content_format = 'TEXT' WHERE content_format IS NULL");
                if (legacy > 0) {
                    logger.info("Marked {} pre-existing notice(s) as plain text", legacy);
                }

                // 검색용 평문 사본. 기존 글은 본문이 곧 평문이라 그대로 복사하면 된다.
                jdbc.update("UPDATE notices SET content_text = content WHERE content_text IS NULL");

                // 신규 글의 기본값은 HTML이다. 위의 TEXT 백필과 값이 다른 것이 의도다.
                jdbc.execute("ALTER TABLE notices ALTER COLUMN pinned SET DEFAULT false");
                jdbc.execute("ALTER TABLE notices ALTER COLUMN pinned SET NOT NULL");
                jdbc.execute("ALTER TABLE notices ALTER COLUMN view_count SET DEFAULT 0");
                jdbc.execute("ALTER TABLE notices ALTER COLUMN view_count SET NOT NULL");
                jdbc.execute("ALTER TABLE notices ALTER COLUMN category SET DEFAULT 'GENERAL'");
                jdbc.execute("ALTER TABLE notices ALTER COLUMN category SET NOT NULL");
                jdbc.execute("ALTER TABLE notices ALTER COLUMN content_format SET DEFAULT 'HTML'");
                jdbc.execute("ALTER TABLE notices ALTER COLUMN content_format SET NOT NULL");

                jdbc.execute("CREATE INDEX IF NOT EXISTS idx_notices_pinned_id ON notices (pinned, id DESC)");
                jdbc.execute("CREATE INDEX IF NOT EXISTS idx_notices_category ON notices (category)");
            } catch (Exception e) {
                // 기동은 막지 않는다. 다만 백필이 빠지면 목록·상세가 제대로 뜨지 않는다.
                logger.error("Failed to migrate notices schema — 공지 목록이 정상 동작하지 않을 수 있습니다", e);
            }
        };
    }

    /**
     * 댓글 길이 불일치 보정.
     *
     * 엔티티에 length가 없던 동안 DDL이 varchar(255)로 생성됐는데 컨트롤러는 500자까지
     * 받는다. ddl-auto=update는 기존 컬럼 길이를 바꾸지 않아 256~500자 댓글이 저장에서
     * 터진다. 길이 확대는 PostgreSQL에서 테이블 재작성 없이 끝난다.
     */
    @Bean
    @Order(11)
    CommandLineRunner widenNoticeCommentContent(JdbcTemplate jdbc) {
        return args -> {
            try {
                Integer length = jdbc.queryForObject(
                        "SELECT character_maximum_length FROM information_schema.columns " +
                        "WHERE table_name = 'notice_comments' AND column_name = 'content'",
                        Integer.class);
                if (length != null && length < 500) {
                    jdbc.execute("ALTER TABLE notice_comments ALTER COLUMN content TYPE varchar(500)");
                    logger.info("Widened notice_comments.content from varchar({}) to varchar(500)", length);
                }
            } catch (Exception e) {
                logger.error("Failed to widen notice_comments.content — 긴 댓글 저장이 실패할 수 있습니다", e);
            }
        };
    }

    /**
     * 조회 기록의 유니크 인덱스.
     *
     * 조회수 중복 방지가 ON CONFLICT (notice_id, username)에 의존하는데, 대상 제약이
     * 없으면 업서트 자체가 에러가 난다. 엔티티에도 @UniqueConstraint를 걸어 뒀지만
     * 이름이 다르게 잡히거나 생성이 밀리는 경우를 대비해 여기서 한 번 더 보장한다.
     */
    @Bean
    @Order(12)
    CommandLineRunner ensureNoticeViewUniqueIndex(JdbcTemplate jdbc) {
        return args -> {
            try {
                jdbc.execute("CREATE UNIQUE INDEX IF NOT EXISTS uk_notice_views_notice_user " +
                             "ON notice_views (notice_id, username)");
            } catch (Exception e) {
                logger.error("Failed to ensure notice_views unique index — 조회수 집계가 실패할 수 있습니다", e);
            }
        };
    }

    /**
     * enum 컬럼의 CHECK 제약을 현재 enum 값 전체로 맞춘다.
     *
     * Hibernate는 @Enumerated(STRING) 컬럼을 만들 때 그 시점의 값만 허용하는 CHECK를
     * 함께 만드는데, ddl-auto=update는 이미 있는 제약을 손대지 않는다. 그래서 나중에
     * 카테고리를 하나 추가하면 새 값을 저장하는 순간 제약 위반으로 실패한다.
     * (users.status에서 실제로 겪은 문제라 같은 방식으로 막는다.)
     */
    @Bean
    @Order(13)
    CommandLineRunner syncNoticeEnumCheckConstraints(JdbcTemplate jdbc) {
        return args -> {
            rebuildCheck(jdbc, "notices", "category", "notices_category_check",
                    Arrays.stream(NoticeCategory.values()).map(Enum::name).toList());
            rebuildCheck(jdbc, "notices", "content_format", "notices_content_format_check",
                    Arrays.stream(NoticeContentFormat.values()).map(Enum::name).toList());
            rebuildCheck(jdbc, "notice_attachments", "kind", "notice_attachments_kind_check",
                    Arrays.stream(AttachmentKind.values()).map(Enum::name).toList());
        };
    }

    /** 첨부 조회 인덱스. 고아 정리는 notice_id가 NULL인 행만 훑으므로 부분 인덱스로 둔다. */
    @Bean
    @Order(14)
    CommandLineRunner indexNoticeAttachments(JdbcTemplate jdbc) {
        return args -> {
            try {
                jdbc.execute("CREATE INDEX IF NOT EXISTS idx_notice_attachments_notice " +
                             "ON notice_attachments (notice_id)");
                jdbc.execute("CREATE INDEX IF NOT EXISTS idx_notice_attachments_orphan " +
                             "ON notice_attachments (created_at) WHERE notice_id IS NULL");
            } catch (Exception e) {
                logger.error("Failed to index notice_attachments", e);
            }
        };
    }

    /**
     * 제약 이름은 Hibernate 버전에 따라 달라질 수 있어 이름을 가정하지 않는다.
     * 해당 컬럼을 언급하는 CHECK 제약을 찾아 지운 뒤 현재 값 목록으로 다시 만든다.
     */
    private void rebuildCheck(JdbcTemplate jdbc, String table, String column,
                              String newName, List<String> values) {
        String allowed = values.stream().map(v -> "'" + v + "'").collect(Collectors.joining(", "));
        try {
            List<String> stale = jdbc.queryForList(
                    "SELECT conname FROM pg_constraint " +
                    "WHERE conrelid = '" + table + "'::regclass AND contype = 'c' " +
                    "AND pg_get_constraintdef(oid) LIKE '%" + column + "%'",
                    String.class);
            for (String name : stale) {
                jdbc.execute("ALTER TABLE " + table + " DROP CONSTRAINT IF EXISTS \"" + name + "\"");
            }
            jdbc.execute("ALTER TABLE " + table + " ADD CONSTRAINT " + newName +
                         " CHECK (" + column + " IS NULL OR " + column + " IN (" + allowed + "))");
            if (!stale.isEmpty()) {
                logger.info("Rebuilt {}.{} check constraint with values: {}", table, column, allowed);
            }
        } catch (Exception e) {
            logger.error("Failed to sync {}.{} check constraint — 새 값 저장이 실패할 수 있습니다",
                    table, column, e);
        }
    }
}
