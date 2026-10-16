package com.hamsetech.hamsetech.notice;

import com.hamsetech.hamsetech.security.SecurityUtils;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NoticeServiceTest {

    @Mock private NoticeRepository noticeRepository;
    @Mock private NoticeCommentRepository commentRepository;
    @Mock private NoticeAttachmentRepository attachmentRepository;
    @Mock private NoticeAttachmentService attachmentService;
    @Mock private NoticeViewService noticeViewService;
    @Mock private NoticeHtmlSanitizer sanitizer;
    @Mock private SecurityUtils securityUtils;
    @Mock private UserAccountRepository userRepository;

    private NoticeService service() {
        return new NoticeService(noticeRepository, commentRepository, attachmentRepository,
                attachmentService, noticeViewService, sanitizer, securityUtils, userRepository);
    }

    @Test
    void rejectsPinningWhenMaximumIsReached() {
        Notice notice = new Notice();
        notice.setPinned(false);
        when(noticeRepository.findById(1L)).thenReturn(Optional.of(notice));
        when(noticeRepository.countByPinnedTrue()).thenReturn(20L);

        assertThatThrownBy(() -> service().setPinned(1L, true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("상단 고정 공지는 최대 20개까지 등록할 수 있습니다.");
        verify(noticeRepository, never()).save(notice);
    }

    @Test
    void returnsOnePageOfCommentThreadsWithTheirReplies() {
        NoticeComment root = org.mockito.Mockito.mock(NoticeComment.class);
        NoticeComment reply = org.mockito.Mockito.mock(NoticeComment.class);
        when(root.getId()).thenReturn(10L);
        when(root.getAuthorUsername()).thenReturn("writer");
        when(root.getContent()).thenReturn("root comment");
        when(reply.getId()).thenReturn(11L);
        when(reply.getAuthorUsername()).thenReturn("replier");
        when(reply.getContent()).thenReturn("reply");
        when(reply.getParent()).thenReturn(root);
        when(noticeRepository.existsById(1L)).thenReturn(true);
        when(commentRepository.findByNoticeIdAndParentIsNullOrderByCreatedAtDescIdDesc(
                org.mockito.ArgumentMatchers.eq(1L), org.mockito.ArgumentMatchers.any()))
                .thenReturn(new PageImpl<>(List.of(root), PageRequest.of(0, 10), 1));
        when(commentRepository.findRepliesByParentIds(List.of(10L))).thenReturn(List.of(reply));
        when(commentRepository.findRepliesByParentIds(List.of(11L))).thenReturn(List.of());
        when(commentRepository.countByNoticeId(1L)).thenReturn(2L);
        when(userRepository.findByUsernameIn(anyCollection())).thenReturn(List.of());

        NoticeCommentPageDto result = service().listComments(1L, PageRequest.of(0, 10));

        assertThat(result.content()).hasSize(2);
        assertThat(result.content().get(0).parentId()).isNull();
        assertThat(result.content().get(1).parentId()).isEqualTo(10L);
        assertThat(result.totalComments()).isEqualTo(2);
        assertThat(result.totalThreads()).isEqualTo(1);
    }
}
