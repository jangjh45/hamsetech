package com.hamsetech.hamsetech.calendar;

import com.hamsetech.hamsetech.admin.AdminLog;
import com.hamsetech.hamsetech.admin.AdminLoggable;
import com.hamsetech.hamsetech.security.SecurityUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/calendar")
public class CalendarEventController {

    private final CalendarEventRepository repo;
    private final SecurityUtils securityUtils;

    public CalendarEventController(CalendarEventRepository repo, SecurityUtils securityUtils) {
        this.repo = repo;
        this.securityUtils = securityUtils;
    }

    public static class UpsertRequest {
        private String date;
        private String time;
        private String title;
        private String scope;

        public String getDate() { return date; }
        public void setDate(String date) { this.date = date; }

        public String getTime() { return time; }
        public void setTime(String time) { this.time = time; }

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }

        public String getScope() { return scope; }
        public void setScope(String scope) { this.scope = scope; }
    }

    /** 로그인하지 않았으면 빈 문자열. 사용자명은 빈 값일 수 없어 개인 일정과 매칭되지 않는다. */
    private String currentUsername(Authentication authentication) {
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            return "";
        }
        return authentication.getName();
    }

    /** 값이 없거나 알 수 없는 값이면 PRIVATE. 공개는 명시적으로 요청할 때만 이뤄져야 한다. */
    private CalendarScope parseScope(String raw) {
        if (raw == null || raw.isBlank()) return CalendarScope.PRIVATE;
        try {
            return CalendarScope.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return CalendarScope.PRIVATE;
        }
    }

    /**
     * 개인 일정은 본인만, 사내 일정은 등록자와 관리자가 고칠 수 있다.
     * 작성자 정보가 없는 도입 이전 일정은 관리자만 정리할 수 있다.
     */
    private boolean canModify(CalendarEvent event, String username) {
        if (username.isEmpty()) return false;
        if (username.equals(event.getCreatedByUsername())) return true;
        return event.getScope() != CalendarScope.PRIVATE && securityUtils.isAdmin();
    }

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.CALENDAR_EVENT, details = "일정 목록 조회")
    @GetMapping
    public List<CalendarEvent> list(@RequestParam(name = "start") String start,
                                    @RequestParam(name = "end") String end,
                                    Authentication authentication) {
        return repo.findVisibleByDateRange(
                LocalDate.parse(start),
                LocalDate.parse(end),
                CalendarScope.COMPANY,
                currentUsername(authentication));
    }

    @AdminLoggable(action = AdminLog.Action.CREATE, entityType = AdminLog.EntityType.CALENDAR_EVENT, details = "일정 생성")
    @PostMapping
    public ResponseEntity<?> create(@RequestBody UpsertRequest req, Authentication authentication) {
        String username = currentUsername(authentication);
        if (username.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "로그인이 필요합니다."));
        }
        if (req == null || req.getDate() == null || req.getDate().isBlank() || req.getTitle() == null || req.getTitle().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "date and title are required"));
        }
        CalendarEvent e = new CalendarEvent();
        e.setDate(LocalDate.parse(req.getDate()));
        e.setTitle(req.getTitle().trim());
        if (req.getTime() != null && !req.getTime().isBlank()) e.setTime(LocalTime.parse(req.getTime()));
        e.setScope(parseScope(req.getScope()));
        e.setCreatedByUsername(username);
        e.setCreatedByDisplayName(securityUtils.currentUserDisplayName());

        CalendarEvent savedEvent = repo.save(e);
        return ResponseEntity.ok(savedEvent);
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.CALENDAR_EVENT, details = "일정 수정")
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable("id") @NonNull Long id, @RequestBody UpsertRequest req, Authentication authentication) {
        String username = currentUsername(authentication);
        if (username.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "로그인이 필요합니다."));
        }
        if (req == null || req.getDate() == null || req.getDate().isBlank() || req.getTitle() == null || req.getTitle().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "date and title are required"));
        }
        return repo.findById(id)
                .map(e -> {
                    if (!canModify(e, username)) {
                        return ResponseEntity.status(403).body(Map.of("code", "FORBIDDEN", "error", "이 일정을 수정할 권한이 없습니다."));
                    }
                    e.setDate(LocalDate.parse(req.getDate()));
                    e.setTitle(req.getTitle().trim());
                    LocalTime newTime = (req.getTime() == null || req.getTime().isBlank()) ? null : LocalTime.parse(req.getTime());
                    e.setTime(newTime);
                    // scope를 안 보내면 기존 공개 범위를 유지한다. 기본값으로 되돌리면
                    // 사내 일정이 조용히 개인 일정이 되어 다른 사람 화면에서 사라진다.
                    if (req.getScope() != null && !req.getScope().isBlank()) {
                        e.setScope(parseScope(req.getScope()));
                    }

                    CalendarEvent savedEvent = repo.save(e);
                    return ResponseEntity.ok(savedEvent);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @AdminLoggable(action = AdminLog.Action.DELETE, entityType = AdminLog.EntityType.CALENDAR_EVENT, details = "일정 삭제")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable("id") @NonNull Long id, Authentication authentication) {
        String username = currentUsername(authentication);
        if (username.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "로그인이 필요합니다."));
        }
        return repo.findById(id)
                .map(e -> {
                    if (!canModify(e, username)) {
                        return ResponseEntity.status(403).body(Map.of("code", "FORBIDDEN", "error", "이 일정을 삭제할 권한이 없습니다."));
                    }
                    repo.deleteById(id);
                    return ResponseEntity.ok(Map.of("deleted", true));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
