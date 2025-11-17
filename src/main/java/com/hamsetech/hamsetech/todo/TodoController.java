package com.hamsetech.hamsetech.todo;

import com.hamsetech.hamsetech.admin.AdminLogService;
import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import com.hamsetech.hamsetech.admin.AdminLog;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/todos")
@PreAuthorize("isAuthenticated()")
public class TodoController {

    private final TodoRepository todoRepo;
    private final UserAccountRepository userRepo;
    private final AdminLogService adminLogService;

    public TodoController(TodoRepository todoRepo, UserAccountRepository userRepo, AdminLogService adminLogService) {
        this.todoRepo = todoRepo;
        this.userRepo = userRepo;
        this.adminLogService = adminLogService;
    }

    private UserAccount getCurrentUser(Authentication authentication) {
        return userRepo.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public static class CreateTodoRequest {
        private String date;
        private String title;
        private String description;
        private Integer priority = 0;

        public String getDate() { return date; }
        public void setDate(String date) { this.date = date; }

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }

        public Integer getPriority() { return priority; }
        public void setPriority(Integer priority) { this.priority = priority; }
    }

    public static class UpdateTodoRequest {
        private String date;
        private String title;
        private String description;
        private Boolean completed;
        private Integer priority;

        public String getDate() { return date; }
        public void setDate(String date) { this.date = date; }

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }

        public Boolean getCompleted() { return completed; }
        public void setCompleted(Boolean completed) { this.completed = completed; }

        public Integer getPriority() { return priority; }
        public void setPriority(Integer priority) { this.priority = priority; }
    }

    @GetMapping
    public List<Todo> list(@RequestParam(name = "start") String start,
                           @RequestParam(name = "end") String end,
                           Authentication authentication) {
        UserAccount user = getCurrentUser(authentication);
        List<Todo> todos = todoRepo.findByUserAndDateRange(user, LocalDate.parse(start), LocalDate.parse(end));

        // 관리자 로깅
        adminLogService.logAdminAction(AdminLog.Action.READ, AdminLog.EntityType.TODO, null,
            String.format("할일 목록 조회 - 기간: %s ~ %s, 결과: %d개", start, end, todos.size()));

        return todos;
    }

    @GetMapping("/date/{date}")
    public List<Todo> getByDate(@PathVariable String date,
                                Authentication authentication) {
        UserAccount user = getCurrentUser(authentication);
        List<Todo> todos = todoRepo.findByUserAndDate(user, LocalDate.parse(date));

        // 관리자 로깅
        adminLogService.logAdminAction(AdminLog.Action.READ, AdminLog.EntityType.TODO, null,
            String.format("특정 날짜 할일 조회 - 날짜: %s, 결과: %d개", date, todos.size()));

        return todos;
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody CreateTodoRequest req,
                                   Authentication authentication) {
        if (req == null || req.getDate() == null || req.getDate().isBlank() ||
            req.getTitle() == null || req.getTitle().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "date and title are required"));
        }

        UserAccount user = getCurrentUser(authentication);
        Todo todo = new Todo();
        todo.setUser(user);
        todo.setDate(LocalDate.parse(req.getDate()));
        todo.setTitle(req.getTitle().trim());
        if (req.getDescription() != null) {
            todo.setDescription(req.getDescription().trim());
        }
        if (req.getPriority() != null) {
            todo.setPriority(req.getPriority());
        }

        Todo savedTodo = todoRepo.save(todo);

        // 관리자 로깅
        adminLogService.logAdminAction(AdminLog.Action.CREATE, AdminLog.EntityType.TODO, savedTodo.getId(),
            String.format("할일 생성 - 제목: %s, 날짜: %s", savedTodo.getTitle(), savedTodo.getDate()));

        return ResponseEntity.ok(savedTodo);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                   @RequestBody UpdateTodoRequest req,
                                   Authentication authentication) {
        if (req == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "request body is required"));
        }

        UserAccount user = getCurrentUser(authentication);

        return todoRepo.findById(id)
                .map(todo -> {
                    // 권한 확인: 본인의 할일만 수정 가능
                    if (!todo.getUser().getId().equals(user.getId())) {
                        return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    }

                    StringBuilder changes = new StringBuilder();
                    if (req.getDate() != null && !req.getDate().isBlank()) {
                        changes.append("날짜: ").append(todo.getDate()).append(" -> ").append(req.getDate()).append(", ");
                        todo.setDate(LocalDate.parse(req.getDate()));
                    }
                    if (req.getTitle() != null && !req.getTitle().isBlank()) {
                        changes.append("제목: ").append(todo.getTitle()).append(" -> ").append(req.getTitle()).append(", ");
                        todo.setTitle(req.getTitle().trim());
                    }
                    if (req.getDescription() != null) {
                        changes.append("설명 변경, ");
                        todo.setDescription(req.getDescription().trim());
                    }
                    if (req.getCompleted() != null) {
                        changes.append("완료: ").append(todo.getCompleted()).append(" -> ").append(req.getCompleted()).append(", ");
                        todo.setCompleted(req.getCompleted());
                    }
                    if (req.getPriority() != null) {
                        changes.append("우선순위: ").append(todo.getPriority()).append(" -> ").append(req.getPriority()).append(", ");
                        todo.setPriority(req.getPriority());
                    }

                    Todo savedTodo = todoRepo.save(todo);

                    // 관리자 로깅
                    adminLogService.logAdminAction(AdminLog.Action.UPDATE, AdminLog.EntityType.TODO, id,
                        String.format("할일 수정 - %s", changes.length() > 0 ? changes.substring(0, changes.length() - 2) : "변경사항 없음"));

                    return ResponseEntity.ok(savedTodo);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id,
                                   Authentication authentication) {
        UserAccount user = getCurrentUser(authentication);

        if (!todoRepo.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        return todoRepo.findById(id)
                .map(todo -> {
                    // 권한 확인: 본인의 할일만 삭제 가능
                    if (!todo.getUser().getId().equals(user.getId())) {
                        return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
                    }

                    String todoTitle = todo.getTitle();
                    LocalDate todoDate = todo.getDate();

                    todoRepo.deleteById(id);

                    // 관리자 로깅
                    adminLogService.logAdminAction(AdminLog.Action.DELETE, AdminLog.EntityType.TODO, id,
                        String.format("할일 삭제 - 제목: %s, 날짜: %s", todoTitle, todoDate));

                    return ResponseEntity.ok(Map.of("deleted", true));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
} 