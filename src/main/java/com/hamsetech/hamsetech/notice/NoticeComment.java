package com.hamsetech.hamsetech.notice;

import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(name = "notice_comments")
public class NoticeComment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Notice 쪽에는 댓글 컬렉션이 없어 공지를 지울 때 Hibernate가 댓글부터 지워 주지 않는다.
     * DB에 CASCADE를 걸어 두지 않으면 댓글이 하나라도 달린 공지는 외래키 위반으로
     * 삭제 자체가 실패한다.
     */
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Notice notice;

    /**
     * 대댓글의 부모 댓글을 참조
     * nullable: 일반 댓글의 경우 parent = null, 대댓글의 경우 parent = 부모 댓글 ID
     * @OnDelete(action = OnDeleteAction.CASCADE): DB 레벨에서 부모 삭제 시 자식도 자동 삭제
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private NoticeComment parent;

    /**
     * 컨트롤러 검증(@Size(max = 500))과 길이를 맞춘다.
     * length를 명시하지 않던 동안 DDL은 varchar(255)로 생성돼, 256~500자 댓글이
     * 검증은 통과하고 DB 저장에서 터졌다. ddl-auto=update는 기존 컬럼 길이를
     * 바꿔주지 않으므로 이미 만들어진 테이블은 NoticeSchemaFixer가 보정한다.
     */
    @Column(nullable = false, length = 500)
    private String content;

    @Column(nullable = false, length = 100)
    private String authorUsername;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    public void prePersist() {
        createdAt = Instant.now();
        updatedAt = createdAt;
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
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
