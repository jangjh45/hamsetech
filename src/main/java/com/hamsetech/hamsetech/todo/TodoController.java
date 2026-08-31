package com.hamsetech.hamsetech.todo;

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
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/todos")
@PreAuthorize("isAuthenticated()")
public class TodoController {

    /** 삭제 성공 응답. 빈 200보다 진단하기 쉽다. */
    private static final Map<String, Object> DELETED = Map.of("deleted", true);

    private final TodoService service;

    public TodoController(TodoService service) {
        this.service = service;
    }

    /**
     * 날짜와 제목은 필수다. 예전에는 자바빈 DTO에 수동 null 검사를 이어 붙였는데,
     * 검증 어노테이션을 쓰면 GlobalExceptionHandler가 같은 400 응답을 만들어 준다.
     */
    public record CreateTodoRequest(
            @NotNull(message = "날짜를 입력해주세요") LocalDate date,
            @NotBlank(message = "할 일을 입력해주세요")
            @Size(max = 255, message = "할 일은 255자 이하여야 합니다") String title,
            String description,
            Integer priority) {}

    /** 보낸 필드만 바뀐다. 전부 선택 항목인 것이 의도다. */
    public record UpdateTodoRequest(
            LocalDate date,
            String title,
            String description,
            Boolean completed,
            Integer priority) {}

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.TODO, details = "할일 목록 조회")
    @GetMapping
    public List<Todo> list(@RequestParam("start") LocalDate start,
                           @RequestParam("end") LocalDate end) {
        return service.listRange(start, end);
    }

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.TODO, details = "특정 날짜 할일 조회")
    @GetMapping("/date/{date}")
    public List<Todo> getByDate(@PathVariable("date") LocalDate date) {
        return service.listByDate(date);
    }

    @AdminLoggable(action = AdminLog.Action.CREATE, entityType = AdminLog.EntityType.TODO, details = "할일 생성")
    @PostMapping
    public Todo create(@Valid @RequestBody CreateTodoRequest req) {
        return service.create(req.date(), req.title(), req.description(), req.priority());
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.TODO, details = "할일 수정")
    @PutMapping("/{id}")
    public Todo update(@PathVariable("id") @NonNull Long id, @RequestBody UpdateTodoRequest req) {
        return service.update(id, req.date(), req.title(), req.description(), req.completed(), req.priority());
    }

    @AdminLoggable(action = AdminLog.Action.DELETE, entityType = AdminLog.EntityType.TODO, details = "할일 삭제")
    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable("id") @NonNull Long id) {
        service.delete(id);
        return DELETED;
    }
}
