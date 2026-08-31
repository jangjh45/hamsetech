package com.hamsetech.hamsetech.calendar;

import com.hamsetech.hamsetech.security.SecurityUtils;
import com.hamsetech.hamsetech.web.ApiExceptions.ForbiddenException;
import com.hamsetech.hamsetech.web.ApiExceptions.NotFoundException;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * 일정.
 *
 * 개인 일정과 사내 일정이 한 테이블에 섞여 있어, 무엇을 보여 주고 무엇을 고치게
 * 할지가 이 클래스의 전부다.
 */
@Service
@Transactional
public class CalendarEventService {

    private final CalendarEventRepository repository;
    private final SecurityUtils securityUtils;

    public CalendarEventService(CalendarEventRepository repository, SecurityUtils securityUtils) {
        this.repository = repository;
        this.securityUtils = securityUtils;
    }

    @Transactional(readOnly = true)
    public List<CalendarEvent> listVisible(LocalDate start, LocalDate end) {
        return repository.findVisibleByDateRange(
                start, end, CalendarScope.COMPANY, securityUtils.currentUsernameOrThrow());
    }

    public CalendarEvent create(LocalDate date, LocalTime time, String title, String scope) {
        CalendarEvent e = new CalendarEvent();
        e.setDate(date);
        e.setTitle(title.trim());
        e.setTime(time);
        e.setScope(parseScope(scope));
        e.setCreatedByUsername(securityUtils.currentUsernameOrThrow());
        e.setCreatedByDisplayName(securityUtils.currentUserDisplayName());
        return repository.save(e);
    }

    public CalendarEvent update(@NonNull Long id, LocalDate date, LocalTime time, String title, String scope) {
        CalendarEvent e = requireModifiable(id);
        e.setDate(date);
        e.setTitle(title.trim());
        e.setTime(time);
        // scope를 안 보내면 기존 공개 범위를 유지한다. 기본값으로 되돌리면
        // 사내 일정이 조용히 개인 일정이 되어 다른 사람 화면에서 사라진다.
        if (scope != null && !scope.isBlank()) {
            e.setScope(parseScope(scope));
        }
        return repository.save(e);
    }

    public void delete(@NonNull Long id) {
        repository.delete(requireModifiable(id));
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
    private CalendarEvent requireModifiable(@NonNull Long id) {
        CalendarEvent event = repository.findById(id)
                .orElseThrow(() -> new NotFoundException("일정을 찾을 수 없습니다."));

        String username = securityUtils.currentUsernameOrThrow();
        boolean mine = username.equals(event.getCreatedByUsername());
        boolean adminOnCompanyEvent = event.getScope() != CalendarScope.PRIVATE && securityUtils.isAdmin();
        if (!mine && !adminOnCompanyEvent) {
            throw new ForbiddenException("이 일정을 수정할 권한이 없습니다.");
        }
        return event;
    }
}
