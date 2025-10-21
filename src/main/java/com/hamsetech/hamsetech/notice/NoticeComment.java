package com.hamsetech.hamsetech.notice;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "notice_comments")
public class NoticeComment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Notice notice;

    /**
     * 대댓글의 부모 댓글을 참조
     * cascade = CascadeType.REMOVE: 부모 댓글이 삭제되면 자식 댓글도 함께 삭제
     * nullable: 일반 댓글의 경우 parent = null, 대댓글의 경우 parent = 부모 댓글 ID
     */
    @ManyToOne(fetch = FetchType.LAZY, cascade = CascadeType.REMOVE)
    private NoticeComment parent;

    @Column(nullable = false)
    private String content;

    @Column(nullable = false, length = 100)
    private String authorUsername;

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
    public Notice getNotice() { return notice; }
    public void setNotice(Notice notice) { this.notice = notice; }
    public NoticeComment getParent() { return parent; }
    public void setParent(NoticeComment parent) { this.parent = parent; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getAuthorUsername() { return authorUsername; }
    public void setAuthorUsername(String authorUsername) { this.authorUsername = authorUsername; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}


