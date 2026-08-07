package com.hamsetech.hamsetech.work;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 엑셀 내보내기 워크북 생성 테스트.
 * 급여 주기가 달력 월과 어긋날 수 있으므로 월 경계를 넘는 기간(7/15~8/14)을 기준으로 검증한다.
 */
class OvertimeExcelExporterTest {

    private static final LocalDate FROM = LocalDate.of(2026, 7, 15);
    private static final LocalDate TO = LocalDate.of(2026, 8, 14);

    private final OvertimeExcelExporter exporter = new OvertimeExcelExporter();

    private List<OvertimeRecord> records;
    private List<Map<String, Object>> summary;

    @BeforeEach
    void setUp() {
        records = List.of(
                // 월 경계 뒤(8월) 기록을 일부러 먼저 넣어 정렬이 실제로 일어나는지 본다
                record("kim", "김한세", LocalDate.of(2026, 8, 3), OvertimeType.OVERTIME,
                        LocalTime.of(16, 0), LocalTime.of(19, 0), 150, OvertimeRecord.Status.APPROVED),
                record("kim", "김한세", LocalDate.of(2026, 7, 18), OvertimeType.SPECIAL,
                        LocalTime.of(7, 0), LocalTime.of(16, 0), 480, OvertimeRecord.Status.APPROVED),
                record("lee", "이기술", LocalDate.of(2026, 7, 20), OvertimeType.OVERTIME,
                        null, null, 90, OvertimeRecord.Status.PENDING),
                record("park", "박특근", LocalDate.of(2026, 8, 1), OvertimeType.SPECIAL,
                        LocalTime.of(7, 0), LocalTime.of(12, 0), 300, OvertimeRecord.Status.REJECTED));

        summary = List.of(
                summaryOf("kim", "김한세", 150, 480, 1, 1),
                summaryOf("choi", null, 60, 0, 1, 0));
    }

    @Test
    @DisplayName("시트는 상세 내역·기간 집계 두 장이다")
    void hasTwoSheets() throws IOException {
        Workbook workbook = build();

        assertThat(workbook.getNumberOfSheets()).isEqualTo(2);
        assertThat(workbook.getSheetName(0)).isEqualTo(OvertimeExcelExporter.DETAIL_SHEET_NAME);
        assertThat(workbook.getSheetName(1)).isEqualTo(OvertimeExcelExporter.SUMMARY_SHEET_NAME);
    }

    @Test
    @DisplayName("상세 시트는 헤더 한 줄 + 기록 수만큼의 행을 가지며 근무일 오름차순이다")
    void detailSheetIsSortedByWorkDate() throws IOException {
        Sheet sheet = build().getSheetAt(0);

        assertThat(sheet.getLastRowNum()).isEqualTo(records.size());
        assertThat(sheet.getRow(0).getCell(0).getStringCellValue()).isEqualTo("근무일");
        assertThat(List.of(
                sheet.getRow(1).getCell(0).getStringCellValue(),
                sheet.getRow(2).getCell(0).getStringCellValue(),
                sheet.getRow(3).getCell(0).getStringCellValue(),
                sheet.getRow(4).getCell(0).getStringCellValue()))
                .containsExactly("2026-07-18", "2026-07-20", "2026-08-01", "2026-08-03");
    }

    @Test
    @DisplayName("총 시간은 엑셀에서 합계를 낼 수 있도록 숫자 셀로 들어간다")
    void totalHoursIsNumeric() throws IOException {
        Sheet sheet = build().getSheetAt(0);

        // 첫 데이터 행 = 2026-07-18 특근 480분
        Cell hours = sheet.getRow(1).getCell(7);
        assertThat(hours.getCellType()).isEqualTo(CellType.NUMERIC);
        assertThat(hours.getNumericCellValue()).isEqualTo(8.0);
    }

    @Test
    @DisplayName("시작·종료 시간이 없는 기록은 시간 칸이 비고 총 시간만 남는다")
    void recordWithoutTimesLeavesTimeCellsEmpty() throws IOException {
        Sheet sheet = build().getSheetAt(0);

        Row row = sheet.getRow(2); // 2026-07-20, 시작/종료 없이 90분
        assertThat(row.getCell(5).getStringCellValue()).isEmpty();
        assertThat(row.getCell(6).getStringCellValue()).isEmpty();
        assertThat(row.getCell(7).getNumericCellValue()).isEqualTo(1.5);
    }

    @Test
    @DisplayName("상태와 구분은 화면과 같은 한글 표기로 나간다")
    void labelsMatchScreenWording() throws IOException {
        Sheet sheet = build().getSheetAt(0);

        assertThat(sheet.getRow(1).getCell(4).getStringCellValue()).isEqualTo("특근");
        assertThat(sheet.getRow(1).getCell(9).getStringCellValue()).isEqualTo("승인");
        assertThat(sheet.getRow(2).getCell(9).getStringCellValue()).isEqualTo("대기");
        assertThat(sheet.getRow(3).getCell(9).getStringCellValue()).isEqualTo("반려");
        assertThat(sheet.getRow(1).getCell(1).getStringCellValue()).isEqualTo("토"); // 2026-07-18
    }

    @Test
    @DisplayName("집계 시트 첫 줄에 기간과 '승인된 기록만' 안내가 들어간다")
    void summarySheetShowsRangeNote() throws IOException {
        Sheet sheet = build().getSheetAt(1);

        assertThat(sheet.getRow(0).getCell(0).getStringCellValue())
                .isEqualTo("2026-07-15 ~ 2026-08-14 · 승인된 기록만 집계");
        assertThat(sheet.getRow(1).getCell(0).getStringCellValue()).isEqualTo("직원");
    }

    @Test
    @DisplayName("집계 시트 마지막 행은 각 열의 합계다")
    void summarySheetHasTotalRow() throws IOException {
        Sheet sheet = build().getSheetAt(1);

        int totalRowNum = 2 + summary.size();
        assertThat(sheet.getLastRowNum()).isEqualTo(totalRowNum);

        Row total = sheet.getRow(totalRowNum);
        assertThat(total.getCell(0).getStringCellValue()).isEqualTo("합계");
        assertThat(total.getCell(2).getNumericCellValue()).isEqualTo(3.5);  // 잔업 150 + 60분
        assertThat(total.getCell(3).getNumericCellValue()).isEqualTo(2);    // 잔업 일수
        assertThat(total.getCell(4).getNumericCellValue()).isEqualTo(8.0);  // 특근 480분
        assertThat(total.getCell(5).getNumericCellValue()).isEqualTo(1);    // 특근 일수
        assertThat(total.getCell(6).getNumericCellValue()).isEqualTo(11.5); // 합계
    }

    @Test
    @DisplayName("표시 이름이 없는 직원은 사번으로 대신 표시된다")
    void fallsBackToUsernameWhenDisplayNameMissing() throws IOException {
        Sheet sheet = build().getSheetAt(1);

        Row choi = sheet.getRow(3);
        assertThat(choi.getCell(0).getStringCellValue()).isEqualTo("choi");
        assertThat(choi.getCell(1).getStringCellValue()).isEqualTo("choi");
    }

    @Test
    @DisplayName("기록이 하나도 없어도 헤더만 있는 워크북이 만들어진다")
    void emptyRangeStillProducesWorkbook() throws IOException {
        byte[] bytes = exporter.build(FROM, TO, List.of(), List.of());

        try (Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            assertThat(workbook.getSheetAt(0).getLastRowNum()).isZero();
            // 집계 시트는 안내 + 헤더 + 합계 행만 남는다
            assertThat(workbook.getSheetAt(1).getLastRowNum()).isEqualTo(2);
            assertThat(workbook.getSheetAt(1).getRow(2).getCell(6).getNumericCellValue()).isZero();
        }
    }

    private Workbook build() throws IOException {
        return new XSSFWorkbook(new ByteArrayInputStream(exporter.build(FROM, TO, records, summary)));
    }

    private OvertimeRecord record(String username, String displayName, LocalDate workDate, OvertimeType type,
                                   LocalTime start, LocalTime end, int totalMinutes, OvertimeRecord.Status status) {
        OvertimeRecord r = new OvertimeRecord();
        r.setUsername(username);
        r.setDisplayName(displayName);
        r.setWorkDate(workDate);
        r.setType(type);
        r.setStartTime(start);
        r.setEndTime(end);
        r.setTotalMinutes(totalMinutes);
        r.setStatus(status);
        return r;
    }

    private Map<String, Object> summaryOf(String username, String displayName, int overtimeMinutes,
                                           int specialMinutes, int overtimeDays, int specialDays) {
        // monthlySummary가 만드는 것과 같은 모양의 맵 (displayName은 null일 수 있어 HashMap을 쓴다)
        Map<String, Object> m = new HashMap<>();
        m.put("username", username);
        m.put("displayName", displayName);
        m.put("overtimeMinutes", overtimeMinutes);
        m.put("specialMinutes", specialMinutes);
        m.put("overtimeDays", overtimeDays);
        m.put("specialDays", specialDays);
        return m;
    }
}
