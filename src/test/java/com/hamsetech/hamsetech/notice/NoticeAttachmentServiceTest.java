package com.hamsetech.hamsetech.notice;

import com.hamsetech.hamsetech.security.SecurityUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 첨부 귀속 규칙 단위 테스트.
 *
 * 파일은 글을 저장하기 전에 먼저 올라간다(본문에 이미지를 넣으려면 URL이 필요하다).
 * 그 사이 상태가 "미확정"(notice == null)이라서, 글을 저장하는 이 시점에 어떤 첨부가
 * 그 글에 속하는지 확정하는 것이 이 서비스의 몫이다.
 *
 * 규칙이 조용히 느슨하면 남의 첨부가 딸려 들어가거나, 고지 않으면 이미지 없는 글이 된다.
 * 전자는 권한 문제이고 후자는 데이터 유실이다.
 */
@ExtendWith(MockitoExtension.class)
class NoticeAttachmentServiceTest {

    @Mock
    private NoticeAttachmentRepository repository;

    @Mock
    private AttachmentStorage storage;

    @Mock
    private SecurityUtils securityUtils;

    private NoticeAttachmentService service;

    @BeforeEach
    void setUp() {
        service = new NoticeAttachmentService(repository, storage, securityUtils);
    }

    // id는 @GeneratedValue라 setter가 없다. 테스트에서만 필드를 직접 채운다.
    private static Notice notice(Long id) {
        Notice n = new Notice();
        ReflectionTestUtils.setField(n, "id", id);
        return n;
    }

    private static NoticeAttachment attachment(Long id, Notice notice, String uploader) {
        NoticeAttachment a = new NoticeAttachment();
        ReflectionTestUtils.setField(a, "id", id);
        a.setNotice(notice);
        a.setUploaderUsername(uploader);
        a.setRelativePath("2026/10/uuid-" + id + ".png");
        a.setStoredFilename("uuid-" + id + ".png");
        a.setOriginalFilename("file.png");
        a.setContentType("image/png");
        a.setFileSize(10);
        a.setKind(AttachmentKind.IMAGE);
        return a;
    }

    @Nested
    @DisplayName("글에 첨부를 확정한다")
    class Claim {

        @Test
        @DisplayName("본문 HTML에 박힌 이미지는 목록에 없어도 붙는다")
        void claimsImageEmbeddedInBody() {
            // 화면이 id 전달을 빠뜨려도 본문에 박힌 이미지는 반드시 글에 붙어야 한다.
            // 그렇지 않으면 저장 직후 이미지가 인증 없이 다시 요청되며 401이 난다.
            when(securityUtils.currentUsername()).thenReturn("kim");
            Notice target = notice(10L);
            NoticeAttachment unclaimed = attachment(5L, null, "kim");

            when(repository.findById(5L)).thenReturn(Optional.of(unclaimed));
            when(repository.findByNoticeIdOrderByIdAsc(10L)).thenReturn(List.of());
            when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

            service.claim(target, List.of(), "<p><img src=\"/api/notices/attachments/5/content\"></p>");

            assertThat(unclaimed.getNotice()).isSameAs(target);
            verify(repository).save(unclaimed);
        }

        @Test
        @DisplayName("남의 미확정 첨부는 가져가지 못한다")
        void refusesOthersUnclaimed() {
            when(securityUtils.currentUsername()).thenReturn("kim");
            NoticeAttachment someoneElse = attachment(6L, null, "park");

            when(repository.findById(6L)).thenReturn(Optional.of(someoneElse));
            when(repository.findByNoticeIdOrderByIdAsc(10L)).thenReturn(List.of());

            service.claim(notice(10L), List.of(6L), "");

            assertThat(someoneElse.getNotice()).isNull();
            verify(repository, never()).save(any());
        }

        @Test
        @DisplayName("이미 다른 글에 붙은 첨부는 무시한다")
        void ignoresAttachmentOfAnotherNotice() {
            when(securityUtils.currentUsername()).thenReturn("kim");
            NoticeAttachment other = attachment(7L, notice(99L), "park");

            when(repository.findById(7L)).thenReturn(Optional.of(other));
            when(repository.findByNoticeIdOrderByIdAsc(10L)).thenReturn(List.of());

            service.claim(notice(10L), List.of(7L), "");

            assertThat(other.getNotice().getId()).isEqualTo(99L);
            verify(repository, never()).save(any());
        }

        @Test
        @DisplayName("이미 이 글에 붙은 첨부는 그대로 둔다")
        void keepsAttachmentAlreadyOnSameNotice() {
            when(securityUtils.currentUsername()).thenReturn("kim");
            Notice target = notice(10L);
            NoticeAttachment mine = attachment(8L, target, "kim");

            when(repository.findById(8L)).thenReturn(Optional.of(mine));
            when(repository.findByNoticeIdOrderByIdAsc(10L)).thenReturn(List.of(mine));

            service.claim(target, List.of(8L), "");

            // 지우면 안 된다 — 목록에 있으므로 삭제 경로에 들어가지 않는다.
            verify(repository, never()).delete(any());
            verify(storage, never()).delete(any());
        }

        @Test
        @DisplayName("수정하면서 빠진 첨부는 글과 파일을 함께 지운다")
        void removesDroppedAttachments() {
            when(securityUtils.currentUsername()).thenReturn("kim");
            Notice target = notice(10L);
            NoticeAttachment dropped = attachment(9L, target, "kim");

            when(repository.findByNoticeIdOrderByIdAsc(10L)).thenReturn(List.of(dropped));

            service.claim(target, List.of(), "");

            verify(repository).delete(dropped);
            verify(storage).delete(dropped.getRelativePath());
        }

        @Test
        @DisplayName("존재하지 않는 첨부 id는 조용히 넘긴다")
        void ignoresMissingIds() {
            when(securityUtils.currentUsername()).thenReturn("kim");
            when(repository.findById(404L)).thenReturn(Optional.empty());
            when(repository.findByNoticeIdOrderByIdAsc(10L)).thenReturn(List.of());

            service.claim(notice(10L), List.of(404L), null);

            verify(repository, never()).delete(any());
        }

        @Test
        @DisplayName("중복 id는 한 번만 처리한다")
        void dedupesIds() {
            // 본문에 두 번 나와 목록에도 있어도 같은 첨부를 두 번 돌리면 안 된다.
            when(securityUtils.currentUsername()).thenReturn("kim");
            NoticeAttachment unclaimed = attachment(5L, null, "kim");
            when(repository.findById(5L)).thenReturn(Optional.of(unclaimed));
            when(repository.findByNoticeIdOrderByIdAsc(10L)).thenReturn(List.of());
            when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

            service.claim(notice(10L), List.of(5L, 5L),
                    "<img src=\"/api/notices/attachments/5/content\"><img src=\"/api/notices/attachments/5/content\">");

            verify(repository).save(unclaimed);
        }
    }

    @Nested
    @DisplayName("업로드")
    class Upload {

        private MultipartFile file(String name) {
            return new MockMultipartFile("file", name, "image/png", new byte[] {1, 2, 3});
        }

        @Test
        @DisplayName("원본 이름에 든 경로를 잘라 낸다")
        void stripsPathFromOriginalName() {
            when(securityUtils.currentUsername()).thenReturn("kim");
            when(storage.store(any(), any())).thenReturn(
                    new AttachmentStorage.Stored("uuid.png", "2026/10/uuid.png", "image/png", 3));
            when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

            NoticeAttachmentDto dto = service.upload(file("../../etc/passwd.png"), AttachmentKind.IMAGE);

            assertThat(dto.originalFilename()).isEqualTo("passwd.png");
        }

        @Test
        @DisplayName("제어문자와 따옴표를 뺀다")
        void stripsControlCharsAndQuotes() {
            when(securityUtils.currentUsername()).thenReturn("kim");
            when(storage.store(any(), any())).thenReturn(
                    new AttachmentStorage.Stored("uuid.png", "2026/10/uuid.png", "image/png", 3));
            when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

            NoticeAttachmentDto dto = service.upload(file("이\r\n\"름\".png"), AttachmentKind.IMAGE);

            assertThat(dto.originalFilename()).doesNotContain("\r").doesNotContain("\n").doesNotContain("\"");
        }

        @Test
        @DisplayName("아무 이름이 없으면 download로 둔다")
        void fallbackName() {
            when(securityUtils.currentUsername()).thenReturn("kim");
            when(storage.store(any(), any())).thenReturn(
                    new AttachmentStorage.Stored("uuid.png", "2026/10/uuid.png", "image/png", 3));
            when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

            assertThat(service.upload(file("  "), AttachmentKind.IMAGE).originalFilename()).isEqualTo("download");
        }

        @Test
        @DisplayName("긴 이름은 확장자를 보존한 채 200자로 자른다")
        void truncatesLongNameKeepingExtension() {
            when(securityUtils.currentUsername()).thenReturn("kim");
            when(storage.store(any(), any())).thenReturn(
                    new AttachmentStorage.Stored("uuid.png", "2026/10/uuid.png", "image/png", 3));
            when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

            String longName = "가".repeat(300) + ".png";
            NoticeAttachmentDto dto = service.upload(file(longName), AttachmentKind.IMAGE);

            // 앞에서 자르면 확장자가 사라져 내려받을 때 이름이 어색해진다.
            assertThat(dto.originalFilename()).hasSize(200).endsWith(".png");
        }
    }

    @Nested
    @DisplayName("고아 첨부 회수")
    class PurgeOrphans {

        @Test
        @DisplayName("글에 안 붙은 첨부만 지우고 개수를 돌려준다")
        void purgesOrphans() {
            NoticeAttachment orphan = attachment(11L, null, "kim");
            Instant cutoff = Instant.now().minusSeconds(3600);
            when(repository.findByNoticeIsNullAndCreatedAtBefore(cutoff)).thenReturn(List.of(orphan));

            int purged = service.purgeOrphans(cutoff);

            assertThat(purged).isEqualTo(1);
            verify(repository).delete(orphan);
            verify(storage).delete(orphan.getRelativePath());
        }

        @Test
        @DisplayName("행이 없으면 아무것도 하지 않는다")
        void nothingToPurge() {
            Instant cutoff = Instant.now().minusSeconds(3600);
            when(repository.findByNoticeIsNullAndCreatedAtBefore(cutoff)).thenReturn(List.of());

            assertThat(service.purgeOrphans(cutoff)).isZero();
            verify(repository, never()).delete(any());
            verifyNoInteractions(storage);
        }
    }
}