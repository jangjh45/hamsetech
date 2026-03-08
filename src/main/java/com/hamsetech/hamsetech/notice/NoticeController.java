package com.hamsetech.hamsetech.notice;

import com.hamsetech.hamsetech.admin.AdminLog;
import com.hamsetech.hamsetech.admin.AdminLoggable;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notices")
public class NoticeController {

    private final NoticeService noticeService;

    public NoticeController(NoticeService noticeService) {
        this.noticeService = noticeService;
    }

    public record NoticeReq(
            @NotBlank(message = "제목을 입력해주세요")
            @Size(max = 200, message = "제목은 200자 이하여야 합니다")
            String title,
            @NotBlank(message = "내용을 입력해주세요")
            String content) {}

    public record CommentReq(
            @NotBlank(message = "댓글 내용을 입력해주세요")
            @Size(max = 500, message = "댓글은 500자 이하여야 합니다")
            String content,
            Long parentId) {}

    @GetMapping
    public Page<Notice> list(@RequestParam(name = "q", defaultValue = "") String q,
                             @RequestParam(name = "page", defaultValue = "0") int page,
                             @RequestParam(name = "size", defaultValue = "10") int size) {
        var pageable = PageRequest.of(page, Math.min(size, 50), Sort.by(Sort.Direction.DESC, "id"));
        return noticeService.listNotices(q, pageable);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Notice> get(@PathVariable @NonNull Long id) {
        Notice notice = noticeService.getNotice(id);
        return notice != null ? ResponseEntity.ok(notice) : ResponseEntity.notFound().build();
    }

    @AdminLoggable(action = AdminLog.Action.CREATE, entityType = AdminLog.EntityType.NOTICE, details = "공지사항 생성")
    @PreAuthorize("isAuthenticated()")
    @PostMapping
    public ResponseEntity<Notice> create(@Valid @RequestBody NoticeReq req) {
        return ResponseEntity.ok(noticeService.createNotice(req.title(), req.content()));
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.NOTICE, details = "공지사항 수정")
    @PreAuthorize("isAuthenticated()")
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable @NonNull Long id,
                                    @Valid @RequestBody NoticeReq req) {
        return noticeService.updateNotice(id, req.title(), req.content());
    }

    @AdminLoggable(action = AdminLog.Action.DELETE, entityType = AdminLog.EntityType.NOTICE, details = "공지사항 삭제")
    @PreAuthorize("isAuthenticated()")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable @NonNull Long id) {
        return noticeService.deleteNotice(id);
    }

    @GetMapping("/{id}/comments")
    public List<NoticeCommentDto> listComments(@PathVariable @NonNull Long id) {
        return noticeService.listComments(id);
    }

    @AdminLoggable(action = AdminLog.Action.CREATE, entityType = AdminLog.EntityType.NOTICE_COMMENT, details = "공지사항 댓글 생성")
    @PreAuthorize("isAuthenticated()")
    @PostMapping("/{id}/comments")
    public ResponseEntity<?> addComment(@PathVariable @NonNull Long id,
                                        @Valid @RequestBody CommentReq req) {
        return noticeService.addComment(id, req.content(), req.parentId());
    }

    @AdminLoggable(action = AdminLog.Action.DELETE, entityType = AdminLog.EntityType.NOTICE_COMMENT, details = "공지사항 댓글 삭제")
    @PreAuthorize("isAuthenticated()")
    @DeleteMapping("/{noticeId}/comments/{commentId}")
    public ResponseEntity<?> deleteComment(@PathVariable @NonNull Long noticeId,
                                           @PathVariable @NonNull Long commentId) {
        return noticeService.deleteComment(noticeId, commentId);
    }
}
