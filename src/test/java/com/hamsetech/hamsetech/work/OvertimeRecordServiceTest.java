package com.hamsetech.hamsetech.work;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 휴게시간 차감 규칙(총 근무시간 계산) 단위 테스트.
 * resolveTotalMinutes는 주입받은 의존성을 쓰지 않으므로 null로 생성해도 된다.
 */
class OvertimeRecordServiceTest {

    private final OvertimeRecordService service = new OvertimeRecordService(null, null, null, null);

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
}
