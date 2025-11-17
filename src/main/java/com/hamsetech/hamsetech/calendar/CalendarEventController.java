package com.hamsetech.hamsetech.calendar;

import com.hamsetech.hamsetech.admin.AdminLogService;
import com.hamsetech.hamsetech.admin.AdminLog;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/calendar")
public class CalendarEventController {

    private final CalendarEventRepository repo;
    private final AdminLogService adminLogService;

    public CalendarEventController(CalendarEventRepository repo, AdminLogService adminLogService) {
        this.repo = repo;
        this.adminLogService = adminLogService;
    }

    public static class UpsertRequest {
        private String date;
        private String time;
        private String title;

        public String getDate() { return date; }
        public void setDate(String date) { this.date = date; }

        public String getTime() { return time; }
        public void setTime(String time) { this.time = time; }

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
    }

    @GetMapping
    public List<CalendarEvent> list(@RequestParam(name = "start") String start,
                                    @RequestParam(name = "end") String end) {
        List<CalendarEvent> events = repo.findByDateRange(LocalDate.parse(start), LocalDate.parse(end));

        // 관리자 로깅
        adminLogService.logAdminAction(AdminLog.Action.READ, AdminLog.EntityType.CALENDAR_EVENT, null,
            String.format("일정 목록 조회 - 기간: %s ~ %s, 결과: %d개", start, end, events.size()));

        return events;
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody UpsertRequest req) {
        if (req == null || req.getDate() == null || req.getDate().isBlank() || req.getTitle() == null || req.getTitle().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "date and title are required"));
        }
        CalendarEvent e = new CalendarEvent();
        e.setDate(LocalDate.parse(req.getDate()));
        e.setTitle(req.getTitle().trim());
        if (req.getTime() != null && !req.getTime().isBlank()) e.setTime(LocalTime.parse(req.getTime()));

        CalendarEvent savedEvent = repo.save(e);

        // 관리자 로깅
        adminLogService.logAdminAction(AdminLog.Action.CREATE, AdminLog.EntityType.CALENDAR_EVENT, savedEvent.getId(),
            String.format("일정 생성 - 제목: %s, 날짜: %s, 시간: %s", savedEvent.getTitle(), savedEvent.getDate(), savedEvent.getTime()));

        return ResponseEntity.ok(savedEvent);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody UpsertRequest req) {
        if (req == null || req.getDate() == null || req.getDate().isBlank() || req.getTitle() == null || req.getTitle().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "date and title are required"));
        }
        return repo.findById(id)
                .map(e -> {
                    StringBuilder changes = new StringBuilder();
                    if (!e.getDate().equals(LocalDate.parse(req.getDate()))) {
                        changes.append("날짜: ").append(e.getDate()).append(" -> ").append(req.getDate()).append(", ");
                    }
                    if (!e.getTitle().equals(req.getTitle().trim())) {
                        changes.append("제목: ").append(e.getTitle()).append(" -> ").append(req.getTitle()).append(", ");
                    }
                    LocalTime newTime = (req.getTime() == null || req.getTime().isBlank()) ? null : LocalTime.parse(req.getTime());
                    if ((e.getTime() == null && newTime != null) || (e.getTime() != null && !e.getTime().equals(newTime))) {
                        changes.append("시간: ").append(e.getTime()).append(" -> ").append(newTime).append(", ");
                    }

                    e.setDate(LocalDate.parse(req.getDate()));
                    e.setTitle(req.getTitle().trim());
                    e.setTime(newTime);

                    CalendarEvent savedEvent = repo.save(e);

                    // 관리자 로깅
                    adminLogService.logAdminAction(AdminLog.Action.UPDATE, AdminLog.EntityType.CALENDAR_EVENT, id,
                        String.format("일정 수정 - %s", changes.length() > 0 ? changes.substring(0, changes.length() - 2) : "변경사항 없음"));

                    return ResponseEntity.ok(savedEvent);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();

        return repo.findById(id)
                .map(event -> {
                    String eventTitle = event.getTitle();
                    LocalDate eventDate = event.getDate();
                    LocalTime eventTime = event.getTime();

                    repo.deleteById(id);

                    // 관리자 로깅
                    adminLogService.logAdminAction(AdminLog.Action.DELETE, AdminLog.EntityType.CALENDAR_EVENT, id,
                        String.format("일정 삭제 - 제목: %s, 날짜: %s, 시간: %s", eventTitle, eventDate, eventTime));

                    return ResponseEntity.ok(Map.of("deleted", true));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}


