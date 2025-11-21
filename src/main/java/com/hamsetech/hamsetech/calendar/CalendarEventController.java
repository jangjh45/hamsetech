package com.hamsetech.hamsetech.calendar;

import com.hamsetech.hamsetech.admin.AdminLog;
import com.hamsetech.hamsetech.admin.AdminLoggable;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/calendar")
public class CalendarEventController {

    private final CalendarEventRepository repo;

    public CalendarEventController(CalendarEventRepository repo) {
        this.repo = repo;
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

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.CALENDAR_EVENT, details = "일정 목록 조회")
    @GetMapping
    public List<CalendarEvent> list(@RequestParam(name = "start") String start,
                                    @RequestParam(name = "end") String end) {
        return repo.findByDateRange(LocalDate.parse(start), LocalDate.parse(end));
    }

    @AdminLoggable(action = AdminLog.Action.CREATE, entityType = AdminLog.EntityType.CALENDAR_EVENT, details = "일정 생성")
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
        return ResponseEntity.ok(savedEvent);
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.CALENDAR_EVENT, details = "일정 수정")
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable("id") @NonNull Long id, @RequestBody UpsertRequest req) {
        if (req == null || req.getDate() == null || req.getDate().isBlank() || req.getTitle() == null || req.getTitle().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "date and title are required"));
        }
        return repo.findById(id)
                .map(e -> {
                    e.setDate(LocalDate.parse(req.getDate()));
                    e.setTitle(req.getTitle().trim());
                    LocalTime newTime = (req.getTime() == null || req.getTime().isBlank()) ? null : LocalTime.parse(req.getTime());
                    e.setTime(newTime);

                    CalendarEvent savedEvent = repo.save(e);
                    return ResponseEntity.ok(savedEvent);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @AdminLoggable(action = AdminLog.Action.DELETE, entityType = AdminLog.EntityType.CALENDAR_EVENT, details = "일정 삭제")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable("id") @NonNull Long id) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();

        repo.deleteById(id);
        return ResponseEntity.ok(Map.of("deleted", true));
    }
}


