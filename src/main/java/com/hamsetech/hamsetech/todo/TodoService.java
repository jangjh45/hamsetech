package com.hamsetech.hamsetech.todo;

import com.hamsetech.hamsetech.security.SecurityUtils;
import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.web.ApiExceptions.ForbiddenException;
import com.hamsetech.hamsetech.web.ApiExceptions.NotFoundException;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * 개인 할 일.
 *
 * 전부 본인 것만 다루므로, 소유자 확인이 이 클래스의 대부분이다.
 * 컨트롤러에 흩어져 있던 그 검사를 여기로 모았다.
 */
@Service
@Transactional
public class TodoService {

    private final TodoRepository todoRepository;
    private final SecurityUtils securityUtils;

    public TodoService(TodoRepository todoRepository, SecurityUtils securityUtils) {
        this.todoRepository = todoRepository;
        this.securityUtils = securityUtils;
    }

    @Transactional(readOnly = true)
    public List<Todo> listRange(LocalDate start, LocalDate end) {
        return todoRepository.findByUserAndDateRange(securityUtils.currentUser(), start, end);
    }

    @Transactional(readOnly = true)
    public List<Todo> listByDate(LocalDate date) {
        return todoRepository.findByUserAndDate(securityUtils.currentUser(), date);
    }

    public Todo create(LocalDate date, String title, String description, Integer priority) {
        UserAccount user = securityUtils.currentUser();

        Todo todo = new Todo();
        todo.setUser(user);
        todo.setDate(date);
        todo.setTitle(title.trim());
        if (description != null) {
            todo.setDescription(description.trim());
        }
        if (priority != null) {
            todo.setPriority(priority);
        }
        return todoRepository.save(todo);
    }

    /** null인 필드는 건드리지 않는다 — 화면이 바뀐 값만 보내기 때문이다. */
    public Todo update(@NonNull Long id, LocalDate date, String title, String description,
                       Boolean completed, Integer priority) {
        Todo todo = requireOwned(id);

        if (date != null) {
            todo.setDate(date);
        }
        if (title != null && !title.isBlank()) {
            todo.setTitle(title.trim());
        }
        if (description != null) {
            todo.setDescription(description.trim());
        }
        if (completed != null) {
            todo.setCompleted(completed);
        }
        if (priority != null) {
            todo.setPriority(priority);
        }
        return todoRepository.save(todo);
    }

    public void delete(@NonNull Long id) {
        todoRepository.delete(requireOwned(id));
    }

    private Todo requireOwned(@NonNull Long id) {
        Todo todo = todoRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("할 일을 찾을 수 없습니다."));
        if (!todo.getUser().getId().equals(securityUtils.currentUser().getId())) {
            throw new ForbiddenException("본인의 할 일만 처리할 수 있습니다.");
        }
        return todo;
    }
}
