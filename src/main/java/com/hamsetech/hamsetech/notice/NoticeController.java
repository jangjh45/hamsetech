package com.hamsetech.hamsetech.notice;

import com.hamsetech.hamsetech.admin.AdminLog;
import com.hamsetech.hamsetech.admin.AdminLoggable;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notices")
public class NoticeController {

    /** 삭제 성공 응답. 화면은 이 값을 읽지 않지만 빈 200보다 진단하기 쉽다. */
    private static final Map<String, Object> DELETED = Map.of("deleted", true);

    private final NoticeService noticeService;

    public NoticeController(NoticeService noticeService) {
        this.noticeService = noticeService;
    }

    public record NoticeReq(
            @NotBlank(message = "제목을 입력해주세요")
            @Size(max = 200, message = "제목은 200자 이하여야 합니다")
            String title,
            @NotBlank(message = "내용을 입력해주세요")
            String content,
            NoticeCategory category,
            boolean pinned,
            /** 본문에 박힌 이미지는 서버가 알아서 찾으므로, 여기엔 일반 첨부만 담기면 된다. */
            List<Long> attachmentIds) {}

    public record PinReq(boolean pinned) {}

    public record CommentReq(
            @NotBlank(message = "댓글 내용을 입력해주세요")
            @Size(max = 500, message = "댓글은 500자 이하여야 합니다")
            String content,
            Long parentId) {}

    @GetMapping
    public NoticeListResponse list(@RequestParam(name = "q", defaultValue = "") String q,
                                   @RequestParam(name = "category", required = false) NoticeCategory category,
                                   @RequestParam(name = "page", defaultValue = "0") int page,
                                   @RequestParam(name = "size", defaultValue = "10") int size) {
        var pageable = PageRequest.of(page, Math.min(size, 50), Sort.by(Sort.Direction.DESC, "id"));
        return noticeService.listNotices(q, category, pageable);
    }

    @GetMapping("/{id}")
    public ResponseEntity<NoticeDetailDto> get(@PathVariable @NonNull Long id) {
        NoticeDetailDto notice = noticeService.getNoticeDetail(id);
        return notice != null ? ResponseEntity.ok(notice) : ResponseEntity.notFound().build();
    }

    /** 이전·다음 글. 목록 API를 다시 훑던 방식은 스캔 범위 밖의 글을 못 찾았다. */
    @GetMapping("/{id}/neighbors")
    public NoticeNeighborsDto neighbors(@PathVariable @NonNull Long id) {
        return noticeService.getNeighbors(id);
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.NOTICE, details = "공지사항 상단 고정 변경")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @PatchMapping("/{id}/pin")
    public Map<String, Object> pin(@PathVariable @NonNull Long id, @RequestBody PinReq req) {
        return Map.of("pinned", noticeService.setPinned(id, req.pinned()));
    }

    @AdminLoggable(action = AdminLog.Action.CREATE, entityType = AdminLog.EntityType.NOTICE, details = "공지사항 생성")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @PostMapping
    public ResponseEntity<NoticeDetailDto> create(@Valid @RequestBody NoticeReq req) {
        return ResponseEntity.ok(noticeService.createNotice(
                req.title(), req.content(), req.category(), req.pinned(), req.attachmentIds()));
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.NOTICE, details = "공지사항 수정")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @PutMapping("/{id}")
    public NoticeDetailDto update(@PathVariable @NonNull Long id,
                                  @Valid @RequestBody NoticeReq req) {
        return noticeService.updateNotice(
                id, req.title(), req.content(), req.category(), req.pinned(), req.attachmentIds());
    }

    @AdminLoggable(action = AdminLog.Action.DELETE, entityType = AdminLog.EntityType.NOTICE, details = "공지사항 삭제")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable @NonNull Long id) {
        noticeService.deleteNotice(id);
        return DELETED;
    }

    @GetMapping("/{id}/comments")
    public List<NoticeCommentDto> listComments(@PathVariable @NonNull Long id) {
        return noticeService.listComments(id);
    }

    @AdminLoggable(action = AdminLog.Action.CREATE, entityType = AdminLog.EntityType.NOTICE_COMMENT, details = "공지사항 댓글 생성")
    @PreAuthorize("isAuthenticated()")
    @PostMapping("/{id}/comments")
    public NoticeCommentDto addComment(@PathVariable @NonNull Long id,
                                       @Valid @RequestBody CommentReq req) {
        return noticeService.addComment(id, req.content(), req.parentId());
    }

    @AdminLoggable(action = AdminLog.Action.DELETE, entityType = AdminLog.EntityType.NOTICE_COMMENT, details = "공지사항 댓글 삭제")
    @PreAuthorize("isAuthenticated()")
    @DeleteMapping("/{noticeId}/comments/{commentId}")
    public Map<String, Object> deleteComment(@PathVariable @NonNull Long noticeId,
                                             @PathVariable @NonNull Long commentId) {
        noticeService.deleteComment(noticeId, commentId);
        return DELETED;
    }
}
