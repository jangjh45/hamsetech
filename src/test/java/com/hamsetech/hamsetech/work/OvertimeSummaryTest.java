package com.hamsetech.hamsetech.work;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 기간 집계가 GROUP BY 결과를 화면·엑셀이 쓰는 형태로 조립하는 부분.
 *
 * 합계 계산 자체는 DB로 넘어갔지만, "한 직원의 두 구분을 한 줄로 합치는" 조립은
 * 여전히 여기서 한다. 잔업만 있거나 특근만 있는 직원의 나머지 칸이 0으로 채워지지
 * 않으면 집계 화면과 엑셀 합계가 깨진다.
 */
class OvertimeSummaryTest {

    private static final LocalDate FROM = LocalDate.of(2026, 7, 15);
    private static final LocalDate TO = LocalDate.of(2026, 8, 14);

    private OvertimeRecordRepository repository;
    private OvertimeRecordService service;

    @BeforeEach
    void setUp() {
        repository = mock(OvertimeRecordRepository.class);
        service = new OvertimeRecordService(repository, null, null, null, null, null);
    }

    private void givenTotals(OvertimeTypeTotal... totals) {
        when(repository.summarizeByUserAndType(eq(OvertimeRecord.Status.APPROVED), any(), any()))
                .thenReturn(List.of(totals));
    }

    private Map<String, Object> rowOf(List<Map<String, Object>> summary, String username) {
        return summary.stream()
                .filter(row -> username.equals(row.get("username")))
                .findFirst()
                .orElseThrow(() -> new AssertionError(username + " 행이 없습니다"));
    }

    @Test
    @DisplayName("두 구분이 모두 있는 직원은 한 줄로 합쳐진다")
    void mergesBothTypesIntoOneRow() {
        givenTotals(
                new OvertimeTypeTotal("kim", "김한세", OvertimeType.OVERTIME, 150L, 1L),
                new OvertimeTypeTotal("kim", "김한세", OvertimeType.SPECIAL, 480L, 1L));

        List<Map<String, Object>> summary = service.monthlySummary(FROM, TO);

        assertThat(summary).hasSize(1);
        Map<String, Object> kim = rowOf(summary, "kim");
        assertThat(kim.get("displayName")).isEqualTo("김한세");
        assertThat(kim.get("overtimeMinutes")).isEqualTo(150);
        assertThat(kim.get("overtimeDays")).isEqualTo(1);
        assertThat(kim.get("specialMinutes")).isEqualTo(480);
        assertThat(kim.get("specialDays")).isEqualTo(1);
    }

    @Test
    @DisplayName("잔업만 있는 직원은 특근 칸이 0으로 채워진다")
    void fillsMissingSpecialWithZero() {
        // GROUP BY는 기록이 없는 구분의 행을 아예 내지 않는다. 그 자리를 0으로
        // 채우지 않으면 화면과 엑셀 합계가 null에서 터진다.
        givenTotals(new OvertimeTypeTotal("lee", "이기술", OvertimeType.OVERTIME, 90L, 1L));

        Map<String, Object> lee = rowOf(service.monthlySummary(FROM, TO), "lee");

        assertThat(lee.get("overtimeMinutes")).isEqualTo(90);
        assertThat(lee.get("specialMinutes")).isEqualTo(0);
        assertThat(lee.get("specialDays")).isEqualTo(0);
    }

    @Test
    @DisplayName("특근만 있는 직원은 잔업 칸이 0으로 채워진다")
    void fillsMissingOvertimeWithZero() {
        givenTotals(new OvertimeTypeTotal("park", "박특근", OvertimeType.SPECIAL, 300L, 1L));

        Map<String, Object> park = rowOf(service.monthlySummary(FROM, TO), "park");

        assertThat(park.get("specialMinutes")).isEqualTo(300);
        assertThat(park.get("overtimeMinutes")).isEqualTo(0);
        assertThat(park.get("overtimeDays")).isEqualTo(0);
    }

    @Test
    @DisplayName("여러 직원은 각자 한 줄씩 나온다")
    void keepsUsersSeparate() {
        givenTotals(
                new OvertimeTypeTotal("kim", "김한세", OvertimeType.OVERTIME, 150L, 1L),
                new OvertimeTypeTotal("lee", "이기술", OvertimeType.OVERTIME, 90L, 2L),
                new OvertimeTypeTotal("lee", "이기술", OvertimeType.SPECIAL, 480L, 1L));

        List<Map<String, Object>> summary = service.monthlySummary(FROM, TO);

        assertThat(summary).hasSize(2);
        assertThat(rowOf(summary, "kim").get("overtimeMinutes")).isEqualTo(150);
        assertThat(rowOf(summary, "lee").get("overtimeDays")).isEqualTo(2);
    }

    @Test
    @DisplayName("표시 이름이 없는 직원도 행이 만들어진다")
    void handlesMissingDisplayName() {
        givenTotals(new OvertimeTypeTotal("choi", null, OvertimeType.OVERTIME, 60L, 1L));

        Map<String, Object> choi = rowOf(service.monthlySummary(FROM, TO), "choi");

        assertThat(choi.get("displayName")).isNull();
        assertThat(choi.get("overtimeMinutes")).isEqualTo(60);
    }

    @Test
    @DisplayName("기록이 없으면 빈 목록이다")
    void emptyWhenNoRecords() {
        givenTotals();

        assertThat(service.monthlySummary(FROM, TO)).isEmpty();
    }
}
