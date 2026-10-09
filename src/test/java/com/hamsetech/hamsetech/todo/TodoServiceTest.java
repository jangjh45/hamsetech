package com.hamsetech.hamsetech.todo;

import com.hamsetech.hamsetech.security.SecurityUtils;
import com.hamsetech.hamsetech.user.UserAccount;
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
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 개인 할 일 소유권 테스트.
 *
 * 이 서비스는 전부 본인 것만 다룬다. 따라서 거의 전부 소유권 확인이다 — 누가
 * 남의 할 일을 고칠 수 있으면 그게 구멍이다. 컨트롤러에 흩어져 있던 그 검사를
 * 여기로 모았으므로, 여기가 막히지 않으면 아무도 안 막는다.
 *
 * 특히 세 가지를 본다.
 * - 남의 할 일을 고치면 403인가. 404로 숨길지 403으로 알릴지는 의도된 선택이다.
 * - 부분 수정은 null인 필드를 건드리지 않는다. 화면이 바뀐 값만 보내기 때문이다.
 * - 목록 조회가 내 것만 부르는가. 남의 것이 섞이면 할 일이 새벽마다 뒤바뀐다.
 */
@ExtendWith(MockitoExtension.class)
class TodoServiceTest {

    @Mock private TodoRepository todoRepository;
    @Mock private SecurityUtils securityUtils;

    private TodoService service;

    @BeforeEach
    void setUp() {
        service = new TodoService(todoRepository, securityUtils);
    }

    private UserAccount user(long id, String username) {
        UserAccount u = new UserAccount();
        ReflectionTestUtils.setField(u, "id", id);
        u.setUsername(username);
        return u;
    }

    private Todo todo(UserAccount owner) {
        Todo t = new Todo();
        ReflectionTestUtils.setField(t, "id", 100L);
        t.setUser(owner);
        t.setDate(LocalDate.of(2026, 3, 10));
        t.setTitle("발주 마감");
        return t;
    }

    @Test
    @DisplayName("남의 할 일을 고치면 막는다")
    void refusesEditingOthersTodo() {
        UserAccount me = user(1, "kim");
        Todo other = todo(user(2, "lee"));
        when(securityUtils.currentUser()).thenReturn(me);
        when(todoRepository.findById(100L)).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> service.update(100L, null, "훔치기", null, null, null))
                .isInstanceOf(ForbiddenException.class);

        verify(todoRepository, never()).save(any());
    }

    @Test
    @DisplayName("남의 할 일을 지우면 막는다")
    void refusesDeletingOthersTodo() {
        when(securityUtils.currentUser()).thenReturn(user(1, "kim"));
        when(todoRepository.findById(100L)).thenReturn(Optional.of(todo(user(2, "lee"))));

        assertThatThrownBy(() -> service.delete(100L))
                .isInstanceOf(ForbiddenException.class);

        verify(todoRepository, never()).delete(any());
    }

    @Test
    @DisplayName("본인의 할 일은 고칠 수 있다")
    void allowsEditingOwnTodo() {
        UserAccount me = user(1, "kim");
        Todo mine = todo(me);
        when(securityUtils.currentUser()).thenReturn(me);
        when(todoRepository.findById(100L)).thenReturn(Optional.of(mine));
        when(todoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.update(100L, null, "  바뀐 제목  ", null, null, null);

        // 앞뒤 공백은 제거한다.
        assertThat(mine.getTitle()).isEqualTo("바뀐 제목");
    }

    @Test
    @DisplayName("없는 할 일은 404로 막는다")
    void refusesMissingTodo() {
        when(todoRepository.findById(100L)).thenReturn(Optional.empty());

        // 403으로 주면 "남의 거"와 "없는 거"를 구별해 줌��. 존재 여부를 숨기려면 404다.
        assertThatThrownBy(() -> service.delete(100L)).isInstanceOf(NotFoundException.class);
    }

    @Test
    @DisplayName("null인 필드는 건드리지 않는다 — 화면이 바뀐 값만 보내기 때문이다")
    void partialUpdateLeavesOthers() {
        UserAccount me = user(1, "kim");
        Todo mine = todo(me);
        mine.setDescription("원래 설명");
        mine.setPriority(2);
        when(securityUtils.currentUser()).thenReturn(me);
        when(todoRepository.findById(100L)).thenReturn(Optional.of(mine));
        when(todoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.update(100L, null, "제목만", null, null, null);

        // 전부 null로 보내면 제목까지 지워진다.
        assertThat(mine.getDescription()).isEqualTo("원래 설명");
        assertThat(mine.getPriority()).isEqualTo(2);
    }

    @Test
    @DisplayName("빈 제목으로는 제목을 지우지 않는다")
    void blankTitleKeepsExisting() {
        UserAccount me = user(1, "kim");
        Todo mine = todo(me);
        when(securityUtils.currentUser()).thenReturn(me);
        when(todoRepository.findById(100L)).thenReturn(Optional.of(mine));
        when(todoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.update(100L, null, "   ", null, null, null);

        // 빈 문자열은 실수로 지워진 것이다. 지우려면 삭제해야 한다.
        assertThat(mine.getTitle()).isEqualTo("발주 마감");
    }

    @Test
    @DisplayName("완료 여부는 false로 되돌릴 수 있다")
    void canUncomplete() {
        UserAccount me = user(1, "kim");
        Todo mine = todo(me);
        mine.setCompleted(true);
        when(securityUtils.currentUser()).thenReturn(me);
        when(todoRepository.findById(100L)).thenReturn(Optional.of(mine));
        when(todoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.update(100L, null, null, null, false, null);

        // null 검사에 걸리면 false가 안 들어간다. 그럼 체크를 못 푼다.
        assertThat(mine.getCompleted()).isFalse();
    }

    @Test
    @DisplayName("만들면 지금 로그인한 사람 것이 된다")
    void createsOwnedByCurrentUser() {
        UserAccount me = user(1, "kim");
        when(securityUtils.currentUser()).thenReturn(me);
        when(todoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Todo created = service.create(LocalDate.of(2026, 3, 10), "  새 할 일  ", null, null);

        // 소유자가 빠지면 남에게 보인다.
        assertThat(created.getUser()).isSameAs(me);
        assertThat(created.getTitle()).isEqualTo("새 할 일");
        assertThat(created.getCompleted()).isFalse();
        assertThat(created.getPriority()).isZero();
    }

    @Test
    @DisplayName("목록 조회는 내 것만 부른다")
    void listsOnlyMine() {
        UserAccount me = user(1, "kim");
        when(securityUtils.currentUser()).thenReturn(me);
        when(todoRepository.findByUserAndDateRange(eq(me), any(), any())).thenReturn(List.of());

        service.listRange(LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31));

        // 남의 것이 섞이면 할 일이 새벽마다 뒤바뀐다.
        verify(todoRepository).findByUserAndDateRange(me, LocalDate.of(2026, 3, 1), LocalDate.of(2026, 3, 31));
        verify(todoRepository, never()).findAll();
    }

    @Test
    @DisplayName("하루 목록도 내 것만 부른다")
    void listsDayOnlyMine() {
        UserAccount me = user(1, "kim");
        when(securityUtils.currentUser()).thenReturn(me);
        when(todoRepository.findByUserAndDate(eq(me), any())).thenReturn(List.of());

        service.listByDate(LocalDate.of(2026, 3, 10));

        verify(todoRepository).findByUserAndDate(me, LocalDate.of(2026, 3, 10));
    }

    @Test
    @DisplayName("본인의 것을 지우는 것은 문제가 없다")
    void allowsDeletingOwnTodo() {
        UserAccount me = user(1, "kim");
        Todo mine = todo(me);
        when(securityUtils.currentUser()).thenReturn(me);
        when(todoRepository.findById(100L)).thenReturn(Optional.of(mine));

        assertThatCode(() -> service.delete(100L)).doesNotThrowAnyException();

        verify(todoRepository).delete(mine);
    }
}