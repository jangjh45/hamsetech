package com.hamsetech.hamsetech.calendar;

import jakarta.persistence.*;
import java.time.*;

@Entity
@Table(name = "calendar_events")
public class CalendarEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDate date;

    private LocalTime time; // nullable

    @Column(nullable = false, length = 255)
    private String title;

    /**
     * 기본값은 PRIVATE. 실수로 전사에 공개되는 쪽보다 안 보이는 쪽이 안전하다.
     *
     * DB 레벨을 nullable로 두는 건 의도적이다. ddl-auto=update는 기존 행이 있는
     * 테이블에 NOT NULL 컬럼을 추가하지 못한다. 값 채우기는 CalendarSchemaFixer가,
     * 이후 non-null 보장은 이 기본값과 컨트롤러가 한다.
     */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private CalendarScope scope = CalendarScope.PRIVATE;

    /** 개인 일정 조회와 수정 권한의 기준. 공지사항과 같이 비정규화해 들고 있는다. */
    @Column(length = 100)
    private String createdByUsername;

    @Column(length = 120)
    private String createdByDisplayName;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }

    public LocalTime getTime() { return time; }
    public void setTime(LocalTime time) { this.time = time; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public CalendarScope getScope() { return scope; }
    public void setScope(CalendarScope scope) { this.scope = scope; }

    public String getCreatedByUsername() { return createdByUsername; }
    public void setCreatedByUsername(String createdByUsername) { this.createdByUsername = createdByUsername; }

    public String getCreatedByDisplayName() { return createdByDisplayName; }
    public void setCreatedByDisplayName(String createdByDisplayName) { this.createdByDisplayName = createdByDisplayName; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}


