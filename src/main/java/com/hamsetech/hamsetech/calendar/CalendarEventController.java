package com.hamsetech.hamsetech.calendar;

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

    @GetMapping
    public List<CalendarEvent> list(@RequestParam(name = "start") String start,
                                    @RequestParam(name = "end") String end) {
        return repo.findByDateRange(LocalDate.parse(start), LocalDate.parse(end));
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
        return ResponseEntity.ok(repo.save(e));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody UpsertRequest req) {
        if (req == null || req.getDate() == null || req.getDate().isBlank() || req.getTitle() == null || req.getTitle().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "date and title are required"));
        }
        return repo.findById(id)
                .map(e -> {
                    e.setDate(LocalDate.parse(req.getDate()));
                    e.setTitle(req.getTitle().trim());
                    e.setTime((req.getTime() == null || req.getTime().isBlank()) ? null : LocalTime.parse(req.getTime()));
                    repo.save(e);
                    return ResponseEntity.ok(e);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!repo.existsById(id)) return ResponseEntity.notFound().build();
        repo.deleteById(id);
        return ResponseEntity.ok(Map.of("deleted", true));
    }
}


