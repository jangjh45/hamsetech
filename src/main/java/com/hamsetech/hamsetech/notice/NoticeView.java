package com.hamsetech.hamsetech.notice;

import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

/**
 * 누가 어떤 공지를 마지막으로 언제 봤는지.
 *
 * 조회수 중복 카운트를 막으려고 둔다. 세션이 없는(STATELESS JWT) 구조라 서버 메모리에
 * 기록해 두는 방식은 인스턴스가 늘면 바로 깨지므로, 판정 자체를 DB 유니크 제약에 맡긴다.
 * (notice_id, username) 유니크 위에서 업서트를 돌리면 동시 요청에도 한 번만 증가한다.
 */
@Entity
@Table(name = "notice_views",
       uniqueConstraints = @UniqueConstraint(name = "uk_notice_views_notice_user",
                                             columnNames = {"notice_id", "username"}))
public class NoticeView {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Notice notice;

    @Column(nullable = false, length = 100)
    private String username;

    @Column(nullable = false)
    private Instant lastViewedAt;

    public Long getId() { return id; }
    public Notice getNotice() { return notice; }
    public void setNotice(Notice notice) { this.notice = notice; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public Instant getLastViewedAt() { return lastViewedAt; }
    public void setLastViewedAt(Instant lastViewedAt) { this.lastViewedAt = lastViewedAt; }
}
