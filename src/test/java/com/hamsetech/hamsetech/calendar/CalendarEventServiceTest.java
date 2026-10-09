package com.hamsetech.hamsetech.calendar;

import com.hamsetech.hamsetech.security.SecurityUtils;
import com.hamsetech.hamsetech.web.ApiExceptions.ForbiddenException;
import com.hamsetech.hamsetech.web.ApiExceptions.NotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 일정 권한 테스트.
 *
 * 개인 일정과 사내 일정이 한 테이블에 섞여 있다. 따라서 이 서비스가 정하는 것은 두
 * 가지다 — 무엇을 보여 주고, 무엇을 고치게 할 것인가.
 *
 * 특히 다섯 가지를 본다.
 * - 공개 범위는 명시적으로 요청해야만 공개된다. 값이 없거나 틀리면 개인 일정이다.
 * - scope를 안 보내면 기존 공개 범위를 유지한다. 기본값으로 되돌리면 사내 일정이
 *   조용히 개인 일정이 되어 다른 사람 화면에서 사라진다.
 * - 개인 일정은 본인만 고친다. 사내 일정은 등록자와 관리자가 고친다.
 * - 작성자 정보가 없는 도입 이전 일정은 관리자만 정리한다.
 * - 만든 사람은 username과 표시 이름을 함께 남긴다. username은 필터에, 표시 이름은
 *   화면에 쓰인다.
 */
@ExtendWith(MockitoExtension.class)
class CalendarEventServiceTest {

    @Mock private CalendarEventRepository repository;
    @Mock private SecurityUtils securityUtils;

    private CalendarEventService service;

    @BeforeEach
    void setUp() {
        service = new CalendarEventService(repository, securityUtils);
    }

    private CalendarEvent event(String creator, CalendarScope scope) {
        CalendarEvent e = new CalendarEvent();
        ReflectionTestUtils.setField(e, "id", 1L);
        e.setDate(LocalDate.of(2026, 3, 10));
        e.setTitle("원래 일정");
        e.setScope(scope);
        e.setCreatedByUsername(creator);
        return e;
    }

    @Test
    @DisplayName("scope를 안 보내면 개인 일정이다 — 공개는 명시해야 한다")
    void defaultScopeIsPrivate() {
        when(securityUtils.currentUsernameOrThrow()).thenReturn("kim");
        when(securityUtils.currentUserDisplayName()).thenReturn("김철수");
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CalendarEvent created = service.create(LocalDate.of(2026, 3, 10), null, "팀 회고", null);

        // 기본값이 공개면 사내 일정이 남의 화면에 노출된다.
        assertThat(created.getScope()).isEqualTo(CalendarScope.PRIVATE);
    }

    @Test
    @DisplayName("알 수 없는 scope도 개인 일정으로 떨어진다")
    void unknownScopeFallsBackToPrivate() {
        when(securityUtils.currentUsernameOrThrow()).thenReturn("kim");
        when(securityUtils.currentUserDisplayName()).thenReturn("김철수");
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CalendarEvent created = service.create(LocalDate.of(2026, 3, 10), null, "테스트", "PUBLIC_X");

        // 예외를 던지면 저장 자체가 안 된다. 조용히 좁히는 편이 낫다.
        assertThat(created.getScope()).isEqualTo(CalendarScope.PRIVATE);
    }

    @Test
    @DisplayName("사내 일정은 명시적으로 공개된다")
    void companyScopeWhenAsked() {
        when(securityUtils.currentUsernameOrThrow()).thenReturn("kim");
        when(securityUtils.currentUserDisplayName()).thenReturn("김철수");
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CalendarEvent created = service.create(LocalDate.of(2026, 3, 10), null, "全员 회의", "company");

        assertThat(created.getScope()).isEqualTo(CalendarScope.COMPANY);
    }

    @Test
    @DisplayName("만든 사람과 표시 이름을 함께 남긴다")
    void recordsCreator() {
        when(securityUtils.currentUsernameOrThrow()).thenReturn("kim");
        when(securityUtils.currentUserDisplayName()).thenReturn("김철수");
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CalendarEvent created = service.create(LocalDate.of(2026, 3, 10), LocalTime.of(9, 0), " 朝会 ", null);

        assertThat(created.getCreatedByUsername()).isEqualTo("kim");
        assertThat(created.getCreatedByDisplayName()).isEqualTo("김철수");
        assertThat(created.getTitle()).isEqualTo("朝会");
    }

    @Test
    @DisplayName("수정할 때 scope를 안 보내면 기존 공개 범위를 유지한다")
    void updateKeepsScopeWhenOmitted() {
        CalendarEvent e = event("kim", CalendarScope.COMPANY);
        when(repository.findById(1L)).thenReturn(Optional.of(e));
        when(securityUtils.currentUsernameOrThrow()).thenReturn("kim");
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.update(1L, LocalDate.of(2026, 3, 11), null, "옮긴 일정", null);

        // 기본값으로 되돌리면 다른 사람 화면에서 사라진다.
        assertThat(e.getScope()).isEqualTo(CalendarScope.COMPANY);
        assertThat(e.getTitle()).isEqualTo("옮긴 일정");
    }

    @Test
    @DisplayName("수정할 때 빈 문자열 scope도 기존 범위를 유지한다")
    void updateKeepsScopeWhenBlank() {
        CalendarEvent e = event("kim", CalendarScope.COMPANY);
        when(repository.findById(1L)).thenReturn(Optional.of(e));
        when(securityUtils.currentUsernameOrThrow()).thenReturn("kim");
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.update(1L, null, null, "제목만", "   ");

        assertThat(e.getScope()).isEqualTo(CalendarScope.COMPANY);
    }

    @Test
    @DisplayName("남의 개인 일정은 고칠 수 없다")
    void refusesOthersPrivateEvent() {
        CalendarEvent e = event("lee", CalendarScope.PRIVATE);
        when(repository.findById(1L)).thenReturn(Optional.of(e));
        when(securityUtils.currentUsernameOrThrow()).thenReturn("kim");

        // 관리자여도 개인 일정은 건드릴 수 없다. scope가 PRIVATE면 isAdmin()도
        // 묻지 않는다 — 관리자가 아니면 어차피 &&가 먼저 거른다.
        assertThatThrownBy(() -> service.update(1L, null, null, "남의 개인 일정", null))
                .isInstanceOf(ForbiddenException.class);
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("관리자는 남의 사내 일정을 고칠 수 있다")
    void adminCanEditCompanyEvent() {
        CalendarEvent e = event("lee", CalendarScope.COMPANY);
        when(repository.findById(1L)).thenReturn(Optional.of(e));
        when(securityUtils.currentUsernameOrThrow()).thenReturn("admin");
        when(securityUtils.isAdmin()).thenReturn(true);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.update(1L, null, null, "수정함", null);

        assertThat(e.getTitle()).isEqualTo("수정함");
    }

    @Test
    @DisplayName("작성자 정보가 없는 도입 이전 일정은 관리자만 정리한다")
    void legacyEventNeedsAdmin() {
        // createdByUsername이 null이면 username.equals(null)이 false가 되어 아무도 못 건다.
        // 개인 일정이면 isAdmin()을 묻지도 않는다.
        CalendarEvent e = event(null, CalendarScope.PRIVATE);
        when(repository.findById(1L)).thenReturn(Optional.of(e));
        when(securityUtils.currentUsernameOrThrow()).thenReturn("kim");

        assertThatThrownBy(() -> service.delete(1L)).isInstanceOf(ForbiddenException.class);
    }

    @Test
    @DisplayName("도입 이전 일정은 관리자가 정리할 수 있다")
    void adminCanCleanLegacyEvent() {
        CalendarEvent e = event(null, CalendarScope.COMPANY);
        when(repository.findById(1L)).thenReturn(Optional.of(e));
        when(securityUtils.currentUsernameOrThrow()).thenReturn("admin");
        when(securityUtils.isAdmin()).thenReturn(true);

        service.delete(1L);

        verify(repository).delete(e);
    }

    @Test
    @DisplayName("없는 일정은 404로 막는다")
    void refusesMissingEvent() {
        when(repository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(1L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("남의 개인 일정을 지우면 막는다")
    void refusesDeletingOthersPrivateEvent() {
        CalendarEvent e = event("lee", CalendarScope.PRIVATE);
        when(repository.findById(1L)).thenReturn(Optional.of(e));
        when(securityUtils.currentUsernameOrThrow()).thenReturn("kim");

        assertThatThrownBy(() -> service.delete(1L)).isInstanceOf(ForbiddenException.class);
        verify(repository, never()).delete(any());
    }

    @Test
    @DisplayName("본인의 일정은 사내 공개 범위든 고칠 수 있다")
    void creatorCanEditOwnEvent() {
        CalendarEvent e = event("kim", CalendarScope.COMPANY);
        when(repository.findById(1L)).thenReturn(Optional.of(e));
        when(securityUtils.currentUsernameOrThrow()).thenReturn("kim");
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.update(1L, LocalDate.of(2026, 3, 12), LocalTime.of(14, 0), "내 일정", "private");

        assertThat(e.getScope()).isEqualTo(CalendarScope.PRIVATE);
        assertThat(e.getTime()).isEqualTo(LocalTime.of(14, 0));
    }
}