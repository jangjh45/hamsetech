package com.hamsetech.hamsetech.work;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 잔업/특근 기록을 엑셀 워크북으로 만든다. DB를 모르고 워크북 생성만 담당한다.
 *
 * <p>시트는 두 장이다.
 * <ul>
 *   <li><b>상세 내역</b> — 기간 안의 모든 기록(대기·반려 포함). 상태 컬럼으로 걸러 쓸 수 있다.</li>
 *   <li><b>기간 집계</b> — 화면 집계와 같은 계산({@code monthlySummary})이라 <b>승인된 기록만</b> 들어간다.</li>
 * </ul>
 * 두 시트의 숫자가 다른 이유가 파일만 보고도 드러나도록 집계 시트 첫 줄에 안내를 넣는다.
 */
@Component
public class OvertimeExcelExporter {

    static final String DETAIL_SHEET_NAME = "상세 내역";
    static final String SUMMARY_SHEET_NAME = "기간 집계";

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter APPROVED_AT_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private static final String[] DETAIL_HEADERS = {
            "근무일", "요일", "직원", "사번", "구분", "시작", "종료", "총 시간(h)", "사유", "상태", "승인자", "승인일시"
    };
    /** 화면(Admin.tsx)과 같은 폭 감각으로 맞춘 컬럼 너비. 1/256 문자 단위. */
    private static final int[] DETAIL_WIDTHS = {
            12, 6, 14, 14, 7, 8, 8, 11, 40, 7, 14, 18
    };

    private static final String[] SUMMARY_HEADERS = {
            "직원", "사번", "잔업 시간(h)", "잔업 일수", "특근 시간(h)", "특근 일수", "합계 시간(h)"
    };
    private static final int[] SUMMARY_WIDTHS = {
            16, 16, 14, 11, 14, 11, 14
    };

    public byte[] build(LocalDate from, LocalDate to, List<OvertimeRecord> records,
                        List<Map<String, Object>> summary) {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Styles styles = new Styles(workbook);
            writeDetailSheet(workbook, styles, records);
            writeSummarySheet(workbook, styles, from, to, summary);
            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException("엑셀 파일을 만들지 못했습니다", e);
        }
    }

    private void writeDetailSheet(Workbook workbook, Styles styles, List<OvertimeRecord> records) {
        Sheet sheet = workbook.createSheet(DETAIL_SHEET_NAME);
        writeHeaderRow(sheet, styles, 0, DETAIL_HEADERS, DETAIL_WIDTHS);
        sheet.createFreezePane(0, 1);

        // 조회 쪽 Specification이 workDate DESC를 강제로 걸기 때문에 정렬은 여기서 보장한다.
        // 호출자가 넘긴 리스트는 건드리지 않는다.
        List<OvertimeRecord> sorted = new ArrayList<>(records);
        sorted.sort(Comparator.comparing((OvertimeRecord r) -> r.getWorkDate())
                .thenComparing(OvertimeRecord::getUsername));

        int rowNum = 1;
        for (OvertimeRecord r : sorted) {
            Row row = sheet.createRow(rowNum++);
            LocalDate workDate = r.getWorkDate();

            text(row, 0, styles, workDate == null ? "" : workDate.format(DATE_FORMAT));
            text(row, 1, styles, weekdayOf(workDate));
            text(row, 2, styles, displayNameOf(r));
            text(row, 3, styles, r.getUsername());
            text(row, 4, styles, typeLabel(r.getType()));
            // 시작/종료 없이 총 분만 입력한 기록은 시간 칸을 비운다.
            text(row, 5, styles, r.getStartTime() == null ? "" : r.getStartTime().format(TIME_FORMAT));
            text(row, 6, styles, r.getEndTime() == null ? "" : r.getEndTime().format(TIME_FORMAT));
            hours(row, 7, styles, r.getTotalMinutes());
            text(row, 8, styles, r.getReason());
            text(row, 9, styles, statusLabel(r.getStatus()));
            text(row, 10, styles, r.getApproverUsername());
            text(row, 11, styles, formatInstant(r.getApprovedAt()));
        }
    }

    private void writeSummarySheet(Workbook workbook, Styles styles, LocalDate from, LocalDate to,
                                   List<Map<String, Object>> summary) {
        Sheet sheet = workbook.createSheet(SUMMARY_SHEET_NAME);

        Row noteRow = sheet.createRow(0);
        Cell note = noteRow.createCell(0);
        note.setCellValue(from.format(DATE_FORMAT) + " ~ " + to.format(DATE_FORMAT) + " · 승인된 기록만 집계");
        note.setCellStyle(styles.note);
        sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, SUMMARY_HEADERS.length - 1));

        writeHeaderRow(sheet, styles, 1, SUMMARY_HEADERS, SUMMARY_WIDTHS);
        sheet.createFreezePane(0, 2);

        int rowNum = 2;
        int overtimeMinutes = 0;
        int specialMinutes = 0;
        int overtimeDays = 0;
        int specialDays = 0;

        for (Map<String, Object> s : summary) {
            int otMin = intValue(s.get("overtimeMinutes"));
            int spMin = intValue(s.get("specialMinutes"));
            int otDays = intValue(s.get("overtimeDays"));
            int spDays = intValue(s.get("specialDays"));
            overtimeMinutes += otMin;
            specialMinutes += spMin;
            overtimeDays += otDays;
            specialDays += spDays;

            String username = (String) s.get("username");
            String displayName = (String) s.get("displayName");

            Row row = sheet.createRow(rowNum++);
            text(row, 0, styles, displayName == null || displayName.isBlank() ? username : displayName);
            text(row, 1, styles, username);
            hours(row, 2, styles, otMin);
            number(row, 3, styles, otDays);
            hours(row, 4, styles, spMin);
            number(row, 5, styles, spDays);
            hours(row, 6, styles, otMin + spMin);
        }

        Row total = sheet.createRow(rowNum);
        totalText(total, 0, styles, "합계");
        totalText(total, 1, styles, "");
        totalHours(total, 2, styles, overtimeMinutes);
        totalNumber(total, 3, styles, overtimeDays);
        totalHours(total, 4, styles, specialMinutes);
        totalNumber(total, 5, styles, specialDays);
        totalHours(total, 6, styles, overtimeMinutes + specialMinutes);
    }

    private void writeHeaderRow(Sheet sheet, Styles styles, int rowNum, String[] headers, int[] widths) {
        Row row = sheet.createRow(rowNum);
        for (int i = 0; i < headers.length; i++) {
            // autoSizeColumn은 AWT 폰트 메트릭에 기대는데 컨테이너에 한글 폰트가 없을 수 있어 폭을 직접 지정한다.
            sheet.setColumnWidth(i, widths[i] * 256);
            Cell cell = row.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(styles.header);
        }
    }

    private void text(Row row, int column, Styles styles, String value) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value == null ? "" : value);
        cell.setCellStyle(styles.text);
    }

    /** 총 시간은 엑셀에서 바로 SUM이 되도록 문자열이 아닌 숫자 셀로 넣는다. */
    private void hours(Row row, int column, Styles styles, Integer minutes) {
        Cell cell = row.createCell(column);
        cell.setCellValue(minutes == null ? 0d : minutes / 60.0);
        cell.setCellStyle(styles.hours);
    }

    private void number(Row row, int column, Styles styles, int value) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value);
        cell.setCellStyle(styles.number);
    }

    private void totalText(Row row, int column, Styles styles, String value) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value);
        cell.setCellStyle(styles.totalText);
    }

    private void totalHours(Row row, int column, Styles styles, int minutes) {
        Cell cell = row.createCell(column);
        cell.setCellValue(minutes / 60.0);
        cell.setCellStyle(styles.totalHours);
    }

    private void totalNumber(Row row, int column, Styles styles, int value) {
        Cell cell = row.createCell(column);
        cell.setCellValue(value);
        cell.setCellStyle(styles.totalNumber);
    }

    private String displayNameOf(OvertimeRecord r) {
        String displayName = r.getDisplayName();
        return displayName == null || displayName.isBlank() ? r.getUsername() : displayName;
    }

    private String weekdayOf(LocalDate date) {
        return date == null ? "" : date.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.KOREAN);
    }

    private String formatInstant(Instant instant) {
        return instant == null ? "" : APPROVED_AT_FORMAT.format(instant.atZone(ZoneId.systemDefault()));
    }

    /** 화면(Admin.tsx OVERTIME_TYPE_LABEL)과 같은 표기 */
    private String typeLabel(OvertimeType type) {
        if (type == null) return "";
        return type == OvertimeType.SPECIAL ? "특근" : "잔업";
    }

    /** 화면(Admin.tsx OVERTIME_STATUS_LABEL)과 같은 표기 */
    private String statusLabel(OvertimeRecord.Status status) {
        if (status == null) return "";
        return switch (status) {
            case PENDING -> "대기";
            case APPROVED -> "승인";
            case REJECTED -> "반려";
        };
    }

    private int intValue(Object value) {
        return value instanceof Number n ? n.intValue() : 0;
    }

    /** 워크북마다 새로 만들어야 하는 셀 스타일 묶음. */
    private static final class Styles {
        private final CellStyle header;
        private final CellStyle note;
        private final CellStyle text;
        private final CellStyle hours;
        private final CellStyle number;
        private final CellStyle totalText;
        private final CellStyle totalHours;
        private final CellStyle totalNumber;

        Styles(Workbook workbook) {
            DataFormat formats = workbook.createDataFormat();
            short oneDecimal = formats.getFormat("0.0");

            Font bold = workbook.createFont();
            bold.setBold(true);

            header = workbook.createCellStyle();
            header.setFont(bold);
            header.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            header.setAlignment(HorizontalAlignment.CENTER);
            header.setVerticalAlignment(VerticalAlignment.CENTER);
            border(header);

            note = workbook.createCellStyle();
            note.setFont(bold);
            note.setVerticalAlignment(VerticalAlignment.CENTER);

            text = workbook.createCellStyle();
            text.setVerticalAlignment(VerticalAlignment.CENTER);
            border(text);

            hours = workbook.createCellStyle();
            hours.cloneStyleFrom(text);
            hours.setDataFormat(oneDecimal);
            hours.setAlignment(HorizontalAlignment.RIGHT);

            number = workbook.createCellStyle();
            number.cloneStyleFrom(text);
            number.setAlignment(HorizontalAlignment.RIGHT);

            totalText = workbook.createCellStyle();
            totalText.cloneStyleFrom(text);
            totalText.setFont(bold);
            totalText.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
            totalText.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            totalHours = workbook.createCellStyle();
            totalHours.cloneStyleFrom(totalText);
            totalHours.setDataFormat(oneDecimal);
            totalHours.setAlignment(HorizontalAlignment.RIGHT);

            totalNumber = workbook.createCellStyle();
            totalNumber.cloneStyleFrom(totalText);
            totalNumber.setAlignment(HorizontalAlignment.RIGHT);
        }

        private void border(CellStyle style) {
            style.setBorderTop(BorderStyle.THIN);
            style.setBorderBottom(BorderStyle.THIN);
            style.setBorderLeft(BorderStyle.THIN);
            style.setBorderRight(BorderStyle.THIN);
        }
    }
}
