package com.hamsetech.hamsetech.work;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * 급여 정산 주기 설정. 정산 기간이 달력 월과 어긋나는 회사를 위해 주기 시작일을 관리자가 지정한다.
 * 예: 15로 두면 정산 기간이 "전달 15일 ~ 이번달 14일"이 된다. (1이면 달력 월과 동일)
 * 전체에 하나만 존재하는 설정이라 행이 하나만 유지된다.
 */
@Entity
@Table(name = "overtime_payroll_setting")
public class OvertimePayrollSetting {

    /** 29~31은 그 날이 없는 달이 있어 주기 시작일로 쓸 수 없다. */
    public static final int MIN_CYCLE_START_DAY = 1;
    public static final int MAX_CYCLE_START_DAY = 28;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private int cycleStartDay;

    private String updatedBy;

    @Column(nullable = false)
    private Instant updatedAt;

    public OvertimePayrollSetting() {}

    public OvertimePayrollSetting(int cycleStartDay) {
        this.cycleStartDay = cycleStartDay;
        this.updatedAt = Instant.now();
    }

    /** 저장 전 범위 검증. 값이 없으면(null) 기존 설정을 유지하라는 뜻이라 예외를 던지지 않는다. */
    public static void validateCycleStartDay(Integer day) {
        if (day == null) {
            return;
        }
        if (day < MIN_CYCLE_START_DAY || day > MAX_CYCLE_START_DAY) {
            throw new IllegalArgumentException(
                    "급여 주기 시작일은 " + MIN_CYCLE_START_DAY + "~" + MAX_CYCLE_START_DAY + " 사이여야 합니다");
        }
    }

    @PrePersist
    @PreUpdate
    public void touch() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public int getCycleStartDay() { return cycleStartDay; }
    public void setCycleStartDay(int cycleStartDay) { this.cycleStartDay = cycleStartDay; }
    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
    public Instant getUpdatedAt() { return updatedAt; }
}
