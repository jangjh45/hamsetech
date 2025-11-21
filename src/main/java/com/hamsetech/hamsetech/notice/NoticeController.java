package com.hamsetech.hamsetech.notice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Sort;
import org.springframework.lang.NonNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;
import com.hamsetech.hamsetech.admin.AdminLog;
import com.hamsetech.hamsetech.admin.AdminLoggable;
import com.hamsetech.hamsetech.user.UserAccountRepository;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notices")
public class NoticeController {
    private final NoticeRepository noticeRepository;
    private final NoticeCommentRepository commentRepository;
    private final UserAccountRepository userAccountRepository;

    public NoticeController(NoticeRepository noticeRepository, NoticeCommentRepository commentRepository, UserAccountRepository userAccountRepository) {
        this.noticeRepository = noticeRepository;
        this.commentRepository = commentRepository;
        this.userAccountRepository = userAccountRepository;
    }

    public record NoticeReq(String title, String content) {}
    public record CommentReq(String content, Long parentId) {}
    public record NoticeCommentDto(Long id, String content, String authorUsername, Long parentId, Instant createdAt) {}

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.NOTICE, details = "공지사항 목록 조회")
    @GetMapping
    public Page<Notice> list(@RequestParam(name = "q", defaultValue = "") String q,
                             @RequestParam(name = "page", defaultValue = "0") int page,
                             @RequestParam(name = "size", defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 50), Sort.by(Sort.Direction.DESC, "id"));
        if (q == null || q.isBlank()) {
            return noticeRepository.findAll(pageable);
        } else {
            return noticeRepository.findByTitleContainingIgnoreCase(q, pageable);
        }
    }

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.NOTICE, details = "공지사항 상세 조회")
    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable("id") @NonNull Long id) {
        return noticeRepository.findById(id)
                .map(notice -> ResponseEntity.ok((Object) notice))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @AdminLoggable(action = AdminLog.Action.CREATE, entityType = AdminLog.EntityType.NOTICE, details = "공지사항 생성")
    @PreAuthorize("isAuthenticated()")
    @PostMapping
    public ResponseEntity<?> create(@RequestBody NoticeReq req) {
        if (req == null || req.title() == null || req.title().isBlank() || req.content() == null || req.content().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "title and content are required"));
        }
        Notice n = new Notice();
        n.setTitle(req.title());
        n.setContent(req.content());
        n.setAuthorUsername(currentUser());
        n.setAuthorDisplayName(currentUserDisplayName());

        Notice savedNotice = noticeRepository.save(n);
        return ResponseEntity.ok(savedNotice);
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.NOTICE, details = "공지사항 수정")
    @PreAuthorize("isAuthenticated()")
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable("id") @NonNull Long id, @RequestBody NoticeReq req) {
        if (req == null || req.title() == null || req.title().isBlank() || req.content() == null || req.content().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "title and content are required"));
        }
        String me = currentUser();
        boolean admin = isAdmin();
        return noticeRepository.findById(id)
                .map(n -> {
                    if (!admin && !n.getAuthorUsername().equals(me)) {
                        return ResponseEntity.status(403).body(Map.of("error", "forbidden"));
                    }

                    n.setTitle(req.title());
                    n.setContent(req.content());

                    Notice savedNotice = noticeRepository.save(n);
                    return ResponseEntity.ok(savedNotice);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @AdminLoggable(action = AdminLog.Action.DELETE, entityType = AdminLog.EntityType.NOTICE, details = "공지사항 삭제")
    @PreAuthorize("isAuthenticated()")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable("id") @NonNull Long id) {
        String me = currentUser();
        boolean admin = isAdmin();
        return noticeRepository.findById(id)
                .map((@NonNull Notice n) -> {
                    if (!admin && !n.getAuthorUsername().equals(me)) {
                        return ResponseEntity.status(403).body(Map.of("error", "forbidden"));
                    }

                    noticeRepository.delete(n);
                    return ResponseEntity.ok(Map.of("deleted", true));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @AdminLoggable(action = AdminLog.Action.READ, entityType = AdminLog.EntityType.NOTICE_COMMENT, details = "공지사항 댓글 목록 조회")
    @GetMapping("/{id}/comments")
    public List<NoticeCommentDto> listComments(@PathVariable("id") @NonNull Long id) {
        return commentRepository.findByNoticeIdOrderByCreatedAtAsc(id).stream()
                .map(c -> new NoticeCommentDto(
                        c.getId(),
                        c.getContent(),
                        c.getAuthorUsername(),
                        c.getParent() == null ? null : c.getParent().getId(),
                        c.getCreatedAt()
                ))
                .toList();
    }

    @AdminLoggable(action = AdminLog.Action.CREATE, entityType = AdminLog.EntityType.NOTICE_COMMENT, details = "공지사항 댓글 생성")
    @PreAuthorize("isAuthenticated()")
    @PostMapping("/{id}/comments")
    public ResponseEntity<?> addComment(@PathVariable("id") @NonNull Long id, @RequestBody CommentReq req) {
        var notice = noticeRepository.findById(id).orElse(null);
        if (notice == null) return ResponseEntity.notFound().build();
        if (req == null || req.content() == null || req.content().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "content is required"));
        }
        NoticeComment c = new NoticeComment();
        c.setNotice(notice);
        c.setContent(req.content());
        c.setAuthorUsername(currentUser());
        if (req.parentId() != null) {
            var parent = commentRepository.findById(java.util.Objects.requireNonNull(req.parentId())).orElse(null);
            if (parent != null && parent.getNotice().getId().equals(id)) {
                c.setParent(parent);
            }
        }

        NoticeComment savedComment = commentRepository.save(c);
        return ResponseEntity.ok(savedComment);
    }

    @AdminLoggable(action = AdminLog.Action.DELETE, entityType = AdminLog.EntityType.NOTICE_COMMENT, details = "공지사항 댓글 삭제")
    @PreAuthorize("isAuthenticated()")
    @DeleteMapping("/{noticeId}/comments/{commentId}")
    public ResponseEntity<?> deleteComment(@PathVariable("noticeId") @NonNull Long noticeId, @PathVariable("commentId") @NonNull Long commentId) {
        String me = currentUser();
        boolean admin = isAdmin();
        return commentRepository.findById(commentId)
                .map(c -> {
                    if (!c.getNotice().getId().equals(noticeId)) {
                        return ResponseEntity.notFound().build();
                    }
                    if (!admin && !c.getAuthorUsername().equals(me)) {
                        return ResponseEntity.status(403).body(Map.of("error", "forbidden"));
                    }

                    commentRepository.delete(c);
                    return ResponseEntity.ok(Map.of("deleted", true));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private String currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : "anonymous";
    }

    private String currentUserDisplayName() {
        String username = currentUser();
        var userOpt = userAccountRepository.findByUsername(username);
        return userOpt.map(u -> (u.getDisplayName() != null && !u.getDisplayName().isBlank()) ? u.getDisplayName() : username)
                .orElse(username);
    }

    private boolean isAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        for (GrantedAuthority ga : auth.getAuthorities()) {
            if ("ROLE_ADMIN".equals(ga.getAuthority())) return true;
            if ("ROLE_SUPER_ADMIN".equals(ga.getAuthority())) return true;
        }
        return false;
    }
}

