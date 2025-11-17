package com.hamsetech.hamsetech.notice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import com.hamsetech.hamsetech.admin.AdminLogService;
import com.hamsetech.hamsetech.admin.AdminLog;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notices")
public class NoticeController {
    private final NoticeRepository noticeRepository;
    private final NoticeCommentRepository commentRepository;
    private final UserAccountRepository userAccountRepository;
    private final AdminLogService adminLogService;

    public NoticeController(NoticeRepository noticeRepository, NoticeCommentRepository commentRepository, UserAccountRepository userAccountRepository, AdminLogService adminLogService) {
        this.noticeRepository = noticeRepository;
        this.commentRepository = commentRepository;
        this.userAccountRepository = userAccountRepository;
        this.adminLogService = adminLogService;
    }

    public record NoticeReq(String title, String content) {}
    public record CommentReq(String content, Long parentId) {}
    public record NoticeCommentDto(Long id, String content, String authorUsername, Long parentId, Instant createdAt) {}

    @GetMapping
    public Page<Notice> list(@RequestParam(name = "q", defaultValue = "") String q,
                             @RequestParam(name = "page", defaultValue = "0") int page,
                             @RequestParam(name = "size", defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 50), Sort.by(Sort.Direction.DESC, "id"));
        Page<Notice> notices;
        if (q == null || q.isBlank()) {
            notices = noticeRepository.findAll(pageable);
        } else {
            notices = noticeRepository.findByTitleContainingIgnoreCase(q, pageable);
        }

        // 관리자 로깅
        String searchQuery = q != null && !q.isBlank() ? q : "전체";
        adminLogService.logAdminAction(AdminLog.Action.READ, AdminLog.EntityType.NOTICE, null,
            String.format("공지사항 목록 조회 - 검색어: %s, 페이지: %d, 크기: %d, 결과: %d개", searchQuery, page, size, notices.getTotalElements()));

        return notices;
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable(name = "id") Long id) {
        var result = noticeRepository.findById(id)
                .map(notice -> {
                    // 관리자 로깅
                    adminLogService.logAdminAction(AdminLog.Action.READ, AdminLog.EntityType.NOTICE, id,
                        String.format("공지사항 상세 조회 - 제목: %s", notice.getTitle()));
                    return ResponseEntity.ok((Object) notice);
                })
                .orElseGet(() -> {
                    // 관리자 로깅 (존재하지 않는 경우)
                    adminLogService.logAdminAction(AdminLog.Action.READ, AdminLog.EntityType.NOTICE, id,
                        "공지사항 조회 실패 - 존재하지 않는 ID");
                    return ResponseEntity.notFound().build();
                });

        return result;
    }

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

        // 관리자 로깅
        adminLogService.logAdminAction(AdminLog.Action.CREATE, AdminLog.EntityType.NOTICE, savedNotice.getId(),
            String.format("공지사항 생성 - 제목: %s, 작성자: %s", savedNotice.getTitle(), savedNotice.getAuthorUsername()));

        return ResponseEntity.ok(savedNotice);
    }

    @PreAuthorize("isAuthenticated()")
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable(name = "id") Long id, @RequestBody NoticeReq req) {
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

                    StringBuilder changes = new StringBuilder();
                    if (!n.getTitle().equals(req.title())) {
                        changes.append("제목: ").append(n.getTitle()).append(" -> ").append(req.title()).append(", ");
                    }
                    if (!n.getContent().equals(req.content())) {
                        changes.append("내용 변경, ");
                    }

                    n.setTitle(req.title());
                    n.setContent(req.content());

                    Notice savedNotice = noticeRepository.save(n);

                    // 관리자 로깅
                    adminLogService.logAdminAction(AdminLog.Action.UPDATE, AdminLog.EntityType.NOTICE, id,
                        String.format("공지사항 수정 - %s", changes.length() > 0 ? changes.substring(0, changes.length() - 2) : "변경사항 없음"));

                    return ResponseEntity.ok(savedNotice);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PreAuthorize("isAuthenticated()")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable(name = "id") Long id) {
        String me = currentUser();
        boolean admin = isAdmin();
        return noticeRepository.findById(id)
                .map(n -> {
                    if (!admin && !n.getAuthorUsername().equals(me)) {
                        return ResponseEntity.status(403).body(Map.of("error", "forbidden"));
                    }

                    String noticeTitle = n.getTitle();
                    String noticeAuthor = n.getAuthorUsername();

                    noticeRepository.delete(n);

                    // 관리자 로깅
                    adminLogService.logAdminAction(AdminLog.Action.DELETE, AdminLog.EntityType.NOTICE, id,
                        String.format("공지사항 삭제 - 제목: %s, 작성자: %s", noticeTitle, noticeAuthor));

                    return ResponseEntity.ok(Map.of("deleted", true));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/comments")
    public List<NoticeCommentDto> listComments(@PathVariable(name = "id") Long id) {
        List<NoticeCommentDto> comments = commentRepository.findByNoticeIdOrderByCreatedAtAsc(id).stream()
                .map(c -> new NoticeCommentDto(
                        c.getId(),
                        c.getContent(),
                        c.getAuthorUsername(),
                        c.getParent() == null ? null : c.getParent().getId(),
                        c.getCreatedAt()
                ))
                .toList();

        // 관리자 로깅
        adminLogService.logAdminAction(AdminLog.Action.READ, AdminLog.EntityType.NOTICE_COMMENT, null,
            String.format("공지사항 댓글 목록 조회 - 공지사항 ID: %d, 댓글 수: %d", id, comments.size()));

        return comments;
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/{id}/comments")
    public ResponseEntity<?> addComment(@PathVariable(name = "id") Long id, @RequestBody CommentReq req) {
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
            var parent = commentRepository.findById(req.parentId()).orElse(null);
            if (parent != null && parent.getNotice().getId().equals(id)) {
                c.setParent(parent);
            }
        }

        NoticeComment savedComment = commentRepository.save(c);

        // 관리자 로깅
        String commentType = req.parentId() != null ? "대댓글" : "댓글";
        adminLogService.logAdminAction(AdminLog.Action.CREATE, AdminLog.EntityType.NOTICE_COMMENT, savedComment.getId(),
            String.format("공지사항 %s 생성 - 공지사항 ID: %d, 작성자: %s", commentType, id, savedComment.getAuthorUsername()));

        return ResponseEntity.ok(savedComment);
    }

    @PreAuthorize("isAuthenticated()")
    @DeleteMapping("/{noticeId}/comments/{commentId}")
    public ResponseEntity<?> deleteComment(@PathVariable(name = "noticeId") Long noticeId, @PathVariable(name = "commentId") Long commentId) {
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

                    String commentAuthor = c.getAuthorUsername();
                    String commentType = c.getParent() != null ? "대댓글" : "댓글";

                    commentRepository.delete(c);

                    // 관리자 로깅
                    adminLogService.logAdminAction(AdminLog.Action.DELETE, AdminLog.EntityType.NOTICE_COMMENT, commentId,
                        String.format("공지사항 %s 삭제 - 공지사항 ID: %d, 작성자: %s", commentType, noticeId, commentAuthor));

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


