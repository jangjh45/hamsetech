package com.hamsetech.hamsetech.notice;

import com.hamsetech.hamsetech.security.SecurityUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.lang.NonNull;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@Transactional
public class NoticeService {

    private final NoticeRepository noticeRepository;
    private final NoticeCommentRepository commentRepository;
    private final SecurityUtils securityUtils;

    public NoticeService(NoticeRepository noticeRepository,
                         NoticeCommentRepository commentRepository,
                         SecurityUtils securityUtils) {
        this.noticeRepository = noticeRepository;
        this.commentRepository = commentRepository;
        this.securityUtils = securityUtils;
    }

    @Transactional(readOnly = true)
    public Page<Notice> listNotices(String q, @NonNull Pageable pageable) {
        if (q == null || q.isBlank()) {
            return noticeRepository.findAll(pageable);
        }
        return noticeRepository.findByTitleContainingIgnoreCase(q, pageable);
    }

    @Transactional(readOnly = true)
    public Notice getNotice(@NonNull Long id) {
        return noticeRepository.findById(id).orElse(null);
    }

    public Notice createNotice(String title, String content) {
        Notice n = new Notice();
        n.setTitle(title);
        n.setContent(content);
        n.setAuthorUsername(securityUtils.currentUsername());
        n.setAuthorDisplayName(securityUtils.currentUserDisplayName());
        return noticeRepository.save(n);
    }

    public ResponseEntity<?> updateNotice(@NonNull Long id, String title, String content) {
        String me = securityUtils.currentUsername();
        boolean admin = securityUtils.isAdmin();
        return noticeRepository.findById(id)
                .map((@NonNull Notice n) -> {
                    if (!admin && !n.getAuthorUsername().equals(me)) {
                        return ResponseEntity.status(403).body(Map.of("error", "forbidden"));
                    }
                    n.setTitle(title);
                    n.setContent(content);
                    return ResponseEntity.ok(noticeRepository.save(n));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    public ResponseEntity<?> deleteNotice(@NonNull Long id) {
        String me = securityUtils.currentUsername();
        boolean admin = securityUtils.isAdmin();
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

    @Transactional(readOnly = true)
    public List<NoticeCommentDto> listComments(@NonNull Long noticeId) {
        return commentRepository.findByNoticeIdOrderByCreatedAtAsc(noticeId).stream()
                .map(c -> new NoticeCommentDto(
                        c.getId(),
                        c.getContent(),
                        c.getAuthorUsername(),
                        c.getParent() == null ? null : c.getParent().getId(),
                        c.getCreatedAt()))
                .toList();
    }

    public ResponseEntity<?> addComment(@NonNull Long noticeId, String content, Long parentId) {
        Notice notice = noticeRepository.findById(noticeId).orElse(null);
        if (notice == null) return ResponseEntity.notFound().build();

        NoticeComment c = new NoticeComment();
        c.setNotice(notice);
        c.setContent(content);
        c.setAuthorUsername(securityUtils.currentUsername());

        if (parentId != null) {
            commentRepository.findById(parentId).ifPresent((@NonNull NoticeComment parent) -> {
                if (parent.getNotice().getId().equals(noticeId)) {
                    c.setParent(parent);
                }
            });
        }

        NoticeComment saved = commentRepository.save(c);
        return ResponseEntity.ok(new NoticeCommentDto(
                saved.getId(),
                saved.getContent(),
                saved.getAuthorUsername(),
                saved.getParent() == null ? null : saved.getParent().getId(),
                saved.getCreatedAt()));
    }

    public ResponseEntity<?> deleteComment(@NonNull Long noticeId, @NonNull Long commentId) {
        String me = securityUtils.currentUsername();
        boolean admin = securityUtils.isAdmin();
        return commentRepository.findById(commentId)
                .map((@NonNull NoticeComment c) -> {
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
}
