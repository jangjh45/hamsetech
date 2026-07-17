package com.hamsetech.hamsetech.work;

import com.hamsetech.hamsetech.admin.AdminLog;
import com.hamsetech.hamsetech.admin.AdminLoggable;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/overtime-records")
public class OvertimeRecordController {

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

    @PreAuthorize("isAuthenticated()")
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable @NonNull Long id, @Valid @RequestBody OvertimeRecordReq req) {
        return service.update(id, req.workDate(), req.type(), req.startTime(), req.endTime(),
                req.totalMinutes(), req.reason());
    }

    @PreAuthorize("isAuthenticated()")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable @NonNull Long id) {
        return service.delete(id);
    }

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

    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @GetMapping("/summary")
    public List<Map<String, Object>> summary(@RequestParam String month) {
        YearMonth ym = YearMonth.parse(month);
        return service.monthlySummary(ym.atDay(1), ym.atEndOfMonth());
    }
}
