package com.hamsetech.hamsetech.notice;

import com.hamsetech.hamsetech.notice.NoticeRepository;
import com.hamsetech.hamsetech.notice.NoticeViewRepository;
import com.hamsetech.hamsetech.notice.NoticeViewService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 조회수 집계 단위 테스트.
 *
 * 조회가 본문 조회를 망가뜨려서는 안 된다는 것이 이 서비스의 존재 이유다. 상세
 * 조회가 쓰기를 유발하는 구조라서, 집계가 예외를 삼키지 않으면 공지를 못 보게 된다.
 * "새 조회였을 때만 1을 올린다"는 규칙도 조용히 깨질 수 있는 곳이라 고정한다.
 */
@ExtendWith(MockitoExtension.class)
class NoticeViewServiceTest {

    @Mock
    private NoticeViewRepository viewRepository;

    @Mock
    private NoticeRepository noticeRepository;

    private NoticeViewService service(int windowHours) {
        return new NoticeViewService(viewRepository, noticeRepository, windowHours);
    }

    private NoticeViewService service() {
        return service(6);
    }

    @Test
    @DisplayName("새 조회는 조회수를 1 올린다")
    void newViewIncrements() {
        when(viewRepository.touch(1L, "kim", 6)).thenReturn(1);

        service().recordView(1L, "kim", "park");

        verify(noticeRepository).incrementViewCount(1L);
    }

    @Test
    @DisplayName("같은 사람이 창 안에 다시 열면 조회수를 올리지 않는다")
    void revisitWithinWindowDoesNotIncrement() {
        // touch가 0을 돌려준다는 건 유니크 제약에 걸려 WHERE가 0행을 갱신했다는 뜻이다.
        // 여기서도 조회수를 올리면 새로고침 연타와 StrictMode의 이펙트 2회 실행이
        // 그대로 조회수로 쌓인다.
        when(viewRepository.touch(1L, "kim", 6)).thenReturn(0);

        service().recordView(1L, "kim", "park");

        verify(noticeRepository, never()).incrementViewCount(anyLong());
    }

    @Test
    @DisplayName("작성자가 자기 글을 여는 것은 조회로 치지 않는다")
    void authorSelfViewIgnored() {
        service().recordView(1L, "park", "park");

        verifyNoInteractions(viewRepository, noticeRepository);
    }

    @Test
    @DisplayName("글 번호가 없으면 아무것도 하지 않는다")
    void nullNoticeIdIgnored() {
        service().recordView(null, "kim", "park");

        verifyNoInteractions(viewRepository, noticeRepository);
    }

    @Test
    @DisplayName("사용자 이름이 비면 아무것도 하지 않는다")
    void blankUsernameIgnored() {
        service().recordView(1L, "  ", "park");

        verifyNoInteractions(viewRepository, noticeRepository);
    }

    @Test
    @DisplayName("집계가 예외를 삼켜도 본문 조회는 영향받지 않는다")
    void failureIsSwallowed() {
        when(viewRepository.touch(eq(1L), anyString(), anyInt())).thenThrow(new RuntimeException("DB down"));

        // 예외가 밖으로 새면 상세 조회 API가 500이 되고 공지를 못 보게 된다.
        assertThatCode(() -> service().recordView(1L, "kim", "park")).doesNotThrowAnyException();
        verify(noticeRepository, never()).incrementViewCount(anyLong());
    }

    @Test
    @DisplayName("조회수 올리기가 실패해도 예외를 삼킨다")
    void incrementFailureIsSwallowed() {
        when(viewRepository.touch(eq(1L), anyString(), anyInt())).thenReturn(1);
        org.mockito.Mockito.doThrow(new RuntimeException("deadlock"))
                .when(noticeRepository).incrementViewCount(1L);

        assertThatCode(() -> service().recordView(1L, "kim", "park")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("조회 창 설정값을 그대로 네이티브 쿼리에 넘긴다")
    void passesWindowHours() {
        when(viewRepository.touch(1L, "kim", 3)).thenReturn(1);

        service(3).recordView(1L, "kim", "park");

        verify(viewRepository).touch(1L, "kim", 3);
    }

    @Test
    @DisplayName("집계는 따로 도는 트랜잭션이다")
    void requiresNewPropagation() throws Exception {
        // 호출부 트랜잭션에서 예외가 나면 읽기까지 롤백된다. 조회를 REQUIRES_NEW로
        // 떼어내는 이유가 이것이므로, 이 값이 바뀌면 본문 조회까지 같이 죽는다.
        Method m = NoticeViewService.class.getMethod("recordView", Long.class, String.class, String.class);
        Transactional t = m.getAnnotation(Transactional.class);
        assertThat(t).isNotNull();
        assertThat(t.propagation()).isEqualTo(Propagation.REQUIRES_NEW);
    }
}