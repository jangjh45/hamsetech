package com.hamsetech.hamsetech.work;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalTime;

/**
 * 잔업/특근 구분별 기본 근무시간. 관리자가 화면에서 수정하며, 등록 폼에서 자동 입력값으로 사용된다.
 * 구분(type)별로 한 행만 존재한다.
 */
@Entity
@Table(name = "overtime_default_times")
public class OvertimeDefaultTime {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    @Enumerated(EnumType.STRING)
    private OvertimeType type;

    @Column(nullable = false)
    private LocalTime startTime;

    @Column(nullable = false)
    private LocalTime endTime;

    private String updatedBy;

    @Column(nullable = false)
    private Instant updatedAt;

    public OvertimeDefaultTime() {}

    public OvertimeDefaultTime(OvertimeType type, LocalTime startTime, LocalTime endTime) {
        this.type = type;
        this.startTime = startTime;
        this.endTime = endTime;
        this.updatedAt = Instant.now();
    }

    @PrePersist
    @PreUpdate
    public void touch() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public OvertimeType getType() { return type; }
    public void setType(OvertimeType type) { this.type = type; }
    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }
    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }
    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
    public Instant getUpdatedAt() { return updatedAt; }
}
