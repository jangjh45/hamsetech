package com.hamsetech.hamsetech.todo;

import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.user.UserAccountRepository;
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

    public TodoController(TodoRepository todoRepo, UserAccountRepository userRepo) {
        this.todoRepo = todoRepo;
        this.userRepo = userRepo;
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
        return todoRepo.findByUserAndDateRange(user, LocalDate.parse(start), LocalDate.parse(end));
    }

    @GetMapping("/date/{date}")
    public List<Todo> getByDate(@PathVariable String date,
                                Authentication authentication) {
        UserAccount user = getCurrentUser(authentication);
        return todoRepo.findByUserAndDate(user, LocalDate.parse(date));
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
        
        return ResponseEntity.ok(todoRepo.save(todo));
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
                    
                    if (req.getDate() != null && !req.getDate().isBlank()) {
                        todo.setDate(LocalDate.parse(req.getDate()));
                    }
                    if (req.getTitle() != null && !req.getTitle().isBlank()) {
                        todo.setTitle(req.getTitle().trim());
                    }
                    if (req.getDescription() != null) {
                        todo.setDescription(req.getDescription().trim());
                    }
                    if (req.getCompleted() != null) {
                        todo.setCompleted(req.getCompleted());
                    }
                    if (req.getPriority() != null) {
                        todo.setPriority(req.getPriority());
                    }
                    todoRepo.save(todo);
                    return ResponseEntity.ok(todo);
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
                    todoRepo.deleteById(id);
                    return ResponseEntity.ok(Map.of("deleted", true));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
} 