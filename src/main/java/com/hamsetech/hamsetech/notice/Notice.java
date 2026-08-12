package com.hamsetech.hamsetech.notice;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "notices")
public class Notice {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    /**
     * 검색 전용 평문 사본.
     *
     * content가 HTML이 되면서 본문 검색을 content에 걸 수 없게 됐다. 태그와 스타일이
     * 그대로 걸려 "color"를 검색하면 글자색을 넣은 글이 전부 나온다.
     */
    @Column(name = "content_text", columnDefinition = "TEXT")
    private String contentText;

    @Column(nullable = false, length = 100)
    private String authorUsername;

    @Column(length = 120)
    private String authorDisplayName;

    // ─────────────────────────────────────────────────────────────
    // 아래 4개는 기존 테이블에 나중에 추가된 컬럼이다.
    //
    // primitive + nullable=false로 선언하면 안 된다. ddl-auto=update가 행이 이미 있는
    // 테이블에 NOT NULL 컬럼을 붙이려다 실패하고, 백필을 맡은 CommandLineRunner는
    // Hibernate보다 늦게 돌아 미리 손쓸 수도 없다. wrapper 타입 + nullable로 받아
    // NoticeSchemaFixer가 백필한 뒤 NOT NULL을 건다. 백필 이전(최초 기동 직후)에
    // NULL을 읽어도 터지지 않도록 게터에서 널을 흡수한다.
    // ─────────────────────────────────────────────────────────────

    @Column(name = "pinned")
    private Boolean pinned = Boolean.FALSE;

    @Column(name = "view_count")
    private Long viewCount = 0L;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", length = 30)
    private NoticeCategory category = NoticeCategory.GENERAL;

    @Enumerated(EnumType.STRING)
    @Column(name = "content_format", length = 10)
    private NoticeContentFormat contentFormat = NoticeContentFormat.HTML;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    public void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getContentText() { return contentText; }
    public void setContentText(String contentText) { this.contentText = contentText; }

    /** 백필 전 NULL을 false로 읽는다. */
    public boolean isPinned() { return Boolean.TRUE.equals(pinned); }
    public void setPinned(boolean pinned) { this.pinned = pinned; }

    /** 백필 전 NULL을 0으로 읽는다. */
    public long getViewCount() { return viewCount == null ? 0L : viewCount; }
    public void setViewCount(long viewCount) { this.viewCount = viewCount; }

    public NoticeCategory getCategory() {
        return category == null ? NoticeCategory.GENERAL : category;
    }
    public void setCategory(NoticeCategory category) { this.category = category; }

    /** NULL은 이 컬럼이 생기기 전에 저장된 글, 즉 평문이다. */
    public NoticeContentFormat getContentFormat() {
        return contentFormat == null ? NoticeContentFormat.TEXT : contentFormat;
    }
    public void setContentFormat(NoticeContentFormat contentFormat) { this.contentFormat = contentFormat; }

    public String getAuthorUsername() { return authorUsername; }
    public void setAuthorUsername(String authorUsername) { this.authorUsername = authorUsername; }
    public String getAuthorDisplayName() { return authorDisplayName; }
    public void setAuthorDisplayName(String authorDisplayName) { this.authorDisplayName = authorDisplayName; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}


