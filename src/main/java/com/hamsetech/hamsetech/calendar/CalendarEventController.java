package com.hamsetech.hamsetech.calendar;

import com.hamsetech.hamsetech.admin.AdminLog;
import com.hamsetech.hamsetech.admin.AdminLoggable;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.lang.NonNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/calendar")
@PreAuthorize("isAuthenticated()")
public class CalendarEventController {

    /** 삭제 성공 응답. 빈 200보다 진단하기 쉽다. */
    private static final Map<String, Object> DELETED = Map.of("deleted", true);

    private final CalendarEventService service;

    public CalendarEventController(CalendarEventService service) {
        this.service = service;
    }

    /**
     * time과 scope는 선택이다.
     *
     * scope를 생략하면 수정 시에는 기존 공개 범위를 유지하고, 생성 시에는 PRIVATE이
     * 된다 — 공개는 명시적으로 요청할 때만 이뤄져야 한다.
     */
    public record UpsertRequest(
            @NotNull(message = "날짜를 입력해주세요") LocalDate date,
            LocalTime time,
            @NotBlank(message = "일정 내용을 입력해주세요")
            @Size(max = 255, message = "일정은 255자 이하여야 합니다") String title,
            String scope) {}

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.CALENDAR_EVENT, details = "일정 목록 조회")
    @GetMapping
    public List<CalendarEvent> list(@RequestParam("start") LocalDate start,
                                    @RequestParam("end") LocalDate end) {
        return service.listVisible(start, end);
    }

    @AdminLoggable(action = AdminLog.Action.CREATE, entityType = AdminLog.EntityType.CALENDAR_EVENT, details = "일정 생성")
    @PostMapping
    public CalendarEvent create(@Valid @RequestBody UpsertRequest req) {
        return service.create(req.date(), req.time(), req.title(), req.scope());
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.CALENDAR_EVENT, details = "일정 수정")
    @PutMapping("/{id}")
    public CalendarEvent update(@PathVariable("id") @NonNull Long id,
                                @Valid @RequestBody UpsertRequest req) {
        return service.update(id, req.date(), req.time(), req.title(), req.scope());
    }

    @AdminLoggable(action = AdminLog.Action.DELETE, entityType = AdminLog.EntityType.CALENDAR_EVENT, details = "일정 삭제")
    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable("id") @NonNull Long id) {
        service.delete(id);
        return DELETED;
    }
}
