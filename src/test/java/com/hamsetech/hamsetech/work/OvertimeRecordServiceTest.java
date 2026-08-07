package com.hamsetech.hamsetech.work;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 휴게시간 차감 규칙(총 근무시간 계산)과 입력값 검증 단위 테스트.
 * 여기서 다루는 메서드들은 주입받은 의존성을 쓰기 전에 판단이 끝나므로 null로 생성해도 된다.
 */
class OvertimeRecordServiceTest {

    private final OvertimeRecordService service = new OvertimeRecordService(null, null, null, null, null, null);

    private int minutes(OvertimeType type, String start, String end) {
        return service.resolveTotalMinutes(type, LocalTime.parse(start), LocalTime.parse(end), null);
    }

    @Test
    @DisplayName("잔업 16:00~19:00 — 저녁 휴게 30분이 빠져 2시간 30분")
    void overtimeSpanningDinner() {
        assertThat(minutes(OvertimeType.OVERTIME, "16:00", "19:00")).isEqualTo(150);
    }

    @Test
    @DisplayName("잔업 16:00~17:00 — 저녁 구간 전에 끝나 차감 없음")
    void overtimeEndingBeforeDinner() {
        assertThat(minutes(OvertimeType.OVERTIME, "16:00", "17:00")).isEqualTo(60);
    }

    @Test
    @DisplayName("잔업 16:00~17:15 — 겹친 15분만 차감")
    void overtimePartiallyOverlappingDinner() {
        assertThat(minutes(OvertimeType.OVERTIME, "16:00", "17:15")).isEqualTo(60);
    }

    @Test
    @DisplayName("잔업 17:30~19:00 — 저녁 구간 후에 시작해 차감 없음")
    void overtimeStartingAfterDinner() {
        assertThat(minutes(OvertimeType.OVERTIME, "17:30", "19:00")).isEqualTo(90);
    }

    @Test
    @DisplayName("특근 07:00~16:00 — 점심 1시간만 차감 (기존 동작 유지)")
    void specialWithLunchOnly() {
        assertThat(minutes(OvertimeType.SPECIAL, "07:00", "16:00")).isEqualTo(480);
    }

    @Test
    @DisplayName("특근 13:00~20:00 — 점심 1시간 + 저녁 30분 차감")
    void specialWithLunchAndDinner() {
        assertThat(minutes(OvertimeType.SPECIAL, "13:00", "20:00")).isEqualTo(330);
    }

    @Test
    @DisplayName("특근 07:00~12:00 — 6시간 미만이라 점심 차감 없음")
    void specialBelowLunchThreshold() {
        assertThat(minutes(OvertimeType.SPECIAL, "07:00", "12:00")).isEqualTo(300);
    }

    @Test
    @DisplayName("잔업 22:00~02:00 — 자정을 넘겨도 저녁 구간과 겹치지 않아 차감 없음")
    void overtimeCrossingMidnight() {
        assertThat(minutes(OvertimeType.OVERTIME, "22:00", "02:00")).isEqualTo(240);
    }

    @Test
    @DisplayName("총 시간 직접 입력은 차감 없이 그대로 저장")
    void manualTotalMinutesPassesThrough() {
        assertThat(service.resolveTotalMinutes(OvertimeType.OVERTIME, null, null, 180)).isEqualTo(180);
    }

    @Test
    @DisplayName("시작/종료 시간도 총 시간도 없으면 예외")
    void missingBothInputsThrows() {
        assertThatThrownBy(() -> service.resolveTotalMinutes(OvertimeType.OVERTIME, null, null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ── 엑셀 내보내기 기간 검증 (DB를 건드리기 전에 걸러지므로 의존성 없이 확인할 수 있다) ──

    @Test
    @DisplayName("내보내기 기간에 빈 날짜가 있으면 예외")
    void exportRejectsMissingDates() {
        assertThatThrownBy(() -> service.exportRange(null, LocalDate.of(2026, 8, 14)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.exportRange(LocalDate.of(2026, 7, 15), null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("시작일이 종료일보다 늦으면 예외")
    void exportRejectsReversedRange() {
        assertThatThrownBy(() -> service.exportRange(LocalDate.of(2026, 8, 14), LocalDate.of(2026, 7, 15)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("시작일");
    }

    @Test
    @DisplayName("366일을 넘는 기간은 예외")
    void exportRejectsTooLongRange() {
        assertThatThrownBy(() -> service.exportRange(LocalDate.of(2025, 1, 1), LocalDate.of(2026, 8, 14)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("최대");
    }

    // ── 급여 주기 시작일 검증 ──

    @Test
    @DisplayName("급여 주기 시작일은 1~28만 허용한다")
    void payrollStartDayRange() {
        // 29~31은 그 날이 없는 달이 있어 주기 시작일로 쓸 수 없다
        assertThatThrownBy(() -> OvertimePayrollSetting.validateCycleStartDay(0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> OvertimePayrollSetting.validateCycleStartDay(29))
                .isInstanceOf(IllegalArgumentException.class);

        assertThatCode(() -> OvertimePayrollSetting.validateCycleStartDay(1)).doesNotThrowAnyException();
        assertThatCode(() -> OvertimePayrollSetting.validateCycleStartDay(15)).doesNotThrowAnyException();
        assertThatCode(() -> OvertimePayrollSetting.validateCycleStartDay(28)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("급여 주기 시작일이 비어 있으면 기존 설정 유지 — 예외 없음")
    void payrollStartDayNullIsAllowed() {
        assertThatCode(() -> OvertimePayrollSetting.validateCycleStartDay(null)).doesNotThrowAnyException();
    }
}
