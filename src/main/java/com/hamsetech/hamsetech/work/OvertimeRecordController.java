package com.hamsetech.hamsetech.work;

import com.hamsetech.hamsetech.admin.AdminLog;
import com.hamsetech.hamsetech.admin.AdminLoggable;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/overtime-records")
public class OvertimeRecordController {

    private static final String XLSX_CONTENT_TYPE =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private final OvertimeRecordService service;

    public OvertimeRecordController(OvertimeRecordService service) {
        this.service = service;
    }

    public record OvertimeRecordReq(
            @NotNull(message = "날짜를 입력해주세요") LocalDate workDate,
            @NotNull(message = "유형을 선택해주세요") OvertimeType type,
            LocalTime startTime,
            LocalTime endTime,
            Integer totalMinutes,
            String reason) {}

    public record RejectReq(String reason) {}

    @AdminLoggable(action = AdminLog.Action.CREATE, entityType = AdminLog.EntityType.OVERTIME_RECORD,
            details = "잔업/특근 신청", adminOnly = false)
    @PreAuthorize("isAuthenticated()")
    @PostMapping
    public ResponseEntity<OvertimeRecord> create(@Valid @RequestBody OvertimeRecordReq req) {
        return ResponseEntity.ok(service.create(req.workDate(), req.type(), req.startTime(), req.endTime(),
                req.totalMinutes(), req.reason()));
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/me")
    public List<OvertimeRecord> listMine(@RequestParam(required = false) LocalDate from,
                                          @RequestParam(required = false) LocalDate to) {
        return service.listMine(from, to);
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.OVERTIME_RECORD,
            details = "잔업/특근 수정", adminOnly = false)
    @PreAuthorize("isAuthenticated()")
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable @NonNull Long id, @Valid @RequestBody OvertimeRecordReq req) {
        return service.update(id, req.workDate(), req.type(), req.startTime(), req.endTime(),
                req.totalMinutes(), req.reason());
    }

    @AdminLoggable(action = AdminLog.Action.DELETE, entityType = AdminLog.EntityType.OVERTIME_RECORD,
            details = "잔업/특근 삭제", adminOnly = false)
    @PreAuthorize("isAuthenticated()")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable @NonNull Long id) {
        return service.delete(id);
    }

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.OVERTIME_RECORD, details = "잔업/특근 전체 목록 조회")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @GetMapping
    public Page<OvertimeRecord> listAll(@RequestParam(required = false) String username,
                                         @RequestParam(required = false) OvertimeType type,
                                         @RequestParam(required = false) OvertimeRecord.Status status,
                                         @RequestParam(required = false) LocalDate from,
                                         @RequestParam(required = false) LocalDate to,
                                         @RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 100), Sort.by(Sort.Direction.DESC, "workDate"));
        return service.listAll(username, type, status, from, to, pageable);
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.OVERTIME_RECORD, details = "잔업/특근 승인")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @PutMapping("/{id}/approve")
    public ResponseEntity<?> approve(@PathVariable @NonNull Long id) {
        return service.approve(id);
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.OVERTIME_RECORD, details = "잔업/특근 반려")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @PutMapping("/{id}/reject")
    public ResponseEntity<?> reject(@PathVariable @NonNull Long id, @RequestBody RejectReq req) {
        return service.reject(id, req.reason());
    }

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.OVERTIME_RECORD,
            details = "잔업/특근 엑셀 다운로드")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @GetMapping("/export")
    public ResponseEntity<?> export(@RequestParam LocalDate from, @RequestParam LocalDate to) {
        byte[] workbook;
        try {
            workbook = service.exportRange(from, to);
        } catch (IllegalArgumentException e) {
            // 이 컨트롤러에는 IllegalArgumentException 전역 핸들러가 없어 그대로 두면 500이 된다.
            // 프론트가 메시지를 그대로 띄울 수 있도록 여기서 400 + {"error": ...}로 바꾼다.
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, XLSX_CONTENT_TYPE)
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(from, to))
                .body(workbook);
    }

    /**
     * 한글 파일명은 그대로 담을 수 없어 ASCII 폴백(filename)과 RFC 5987 형식(filename*)을 함께 준다.
     * 개발 환경은 교차 출처라 브라우저가 이 헤더를 읽지 못하므로, 화면에서는 파일명을 따로 만든다(Admin.tsx).
     */
    private String contentDisposition(LocalDate from, LocalDate to) {
        String korean = "잔업특근_" + from + "_" + to + ".xlsx";
        String encoded = URLEncoder.encode(korean, StandardCharsets.UTF_8).replace("+", "%20");
        return "attachment; filename=\"overtime-" + from + "_" + to + ".xlsx\"; filename*=UTF-8''" + encoded;
    }

    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @GetMapping("/summary")
    public List<Map<String, Object>> summary(@RequestParam String month) {
        YearMonth ym = YearMonth.parse(month);
        return service.monthlySummary(ym.atDay(1), ym.atEndOfMonth());
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/defaults")
    public OvertimeDefaultsDto getDefaults() {
        return service.getDefaults();
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.OVERTIME_RECORD, details = "잔업/특근 기본 근무시간 수정")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @PutMapping("/defaults")
    public OvertimeDefaultsDto updateDefaults(@RequestBody OvertimeDefaultsDto req) {
        return service.updateDefaults(req);
    }
}
