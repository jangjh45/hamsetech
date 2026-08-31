package com.hamsetech.hamsetech.notice;

import com.hamsetech.hamsetech.security.SecurityUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.lang.NonNull;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class NoticeService {

    /**
     * 권한 거부 응답 본문.
     *
     * client.ts는 401/403을 받았을 때 body의 code가 FORBIDDEN인지로
     * "권한 거부"와 "토큰 만료"를 구분한다. code를 빼먹으면 프론트가 만료로 오인해
     * 멀쩡히 로그인한 사용자를 로그아웃시킨다.
     */
    private static final Map<String, String> FORBIDDEN_BODY =
            Map.of("code", "FORBIDDEN", "error", "권한이 없습니다.");

    /** 상단에 고정할 수 있는 공지 수. 이 이상은 고정해도 목록이 고정글로만 채워진다. */
    private static final int MAX_PINNED = 20;

    /** 새니타이징을 마친 본문 길이 상한. 이미지는 첨부로 빠지므로 이 정도면 넉넉하다. */
    private static final int MAX_CONTENT_LENGTH = 200_000;

    private final NoticeRepository noticeRepository;
    private final NoticeCommentRepository commentRepository;
    private final NoticeAttachmentRepository attachmentRepository;
    private final NoticeAttachmentService attachmentService;
    private final NoticeViewService noticeViewService;
    private final NoticeHtmlSanitizer sanitizer;
    private final SecurityUtils securityUtils;

    public NoticeService(NoticeRepository noticeRepository,
                         NoticeCommentRepository commentRepository,
                         NoticeAttachmentRepository attachmentRepository,
                         NoticeAttachmentService attachmentService,
                         NoticeViewService noticeViewService,
                         NoticeHtmlSanitizer sanitizer,
                         SecurityUtils securityUtils) {
        this.noticeRepository = noticeRepository;
        this.commentRepository = commentRepository;
        this.attachmentRepository = attachmentRepository;
        this.attachmentService = attachmentService;
        this.noticeViewService = noticeViewService;
        this.sanitizer = sanitizer;
        this.securityUtils = securityUtils;
    }

    /**
     * 목록. 고정 공지는 페이징 밖으로 빼서 따로 담는다.
     *
     * 정렬에 pinned를 섞으면 고정글이 앞으로 끌려나오면서 화면의 글 번호(전체 건수에서
     * 역순으로 세는 방식)가 어긋난다. 페이지에는 일반글만 담고 고정글은 첫 페이지에서만
     * 따로 내려보내면 기존 번호 계산이 그대로 맞는다.
     */
    @Transactional(readOnly = true)
    public NoticeListResponse listNotices(String q, NoticeCategory category, @NonNull Pageable pageable) {
        Specification<Notice> normalSpec = NoticeSpecification.withFilters(q, category, false);
        Page<Notice> page = noticeRepository.findAll(normalSpec, pageable);

        List<Notice> pinned = pageable.getPageNumber() == 0
                ? noticeRepository.findAll(
                        NoticeSpecification.withFilters(q, category, true),
                        PageRequest.of(0, MAX_PINNED, Sort.by(Sort.Direction.DESC, "id"))).getContent()
                : List.of();

        // 댓글·첨부 수는 두 묶음을 합쳐 한 번씩만 센다
        List<Notice> all = new java.util.ArrayList<>(pinned);
        all.addAll(page.getContent());
        List<Long> ids = all.stream().map(Notice::getId).toList();
        Map<Long, Integer> commentCounts = toCountMap(
                ids.isEmpty() ? List.of() : commentRepository.countByNoticeIds(ids));
        Map<Long, Integer> attachmentCounts = toCountMap(
                ids.isEmpty() ? List.of() : attachmentRepository.countFilesByNoticeIds(ids));

        return new NoticeListResponse(
                toSummaries(pinned, commentCounts, attachmentCounts),
                NoticeListResponse.PageDto.of(page,
                        toSummaries(page.getContent(), commentCounts, attachmentCounts)));
    }

    private List<NoticeSummaryDto> toSummaries(List<Notice> notices,
                                               Map<Long, Integer> commentCounts,
                                               Map<Long, Integer> attachmentCounts) {
        return notices.stream()
                .map(n -> NoticeSummaryDto.of(n,
                        commentCounts.getOrDefault(n.getId(), 0),
                        attachmentCounts.getOrDefault(n.getId(), 0)))
                .toList();
    }

    /** 글마다 count를 날리면 페이지당 10번이 되므로 id를 묶어 한 번에 센다. */
    private Map<Long, Integer> toCountMap(List<Object[]> rows) {
        Map<Long, Integer> counts = new HashMap<>();
        for (Object[] row : rows) {
            counts.put((Long) row[0], ((Number) row[1]).intValue());
        }
        return counts;
    }

    @Transactional(readOnly = true)
    public Notice getNotice(@NonNull Long id) {
        return noticeRepository.findById(id).orElse(null);
    }

    /**
     * 상세. 조회수 집계를 곁들인다.
     *
     * 집계는 별도 트랜잭션에서 돌고 실패해도 삼켜지므로, 조회수가 안 올라가더라도
     * 본문은 정상적으로 내려간다.
     */
    @Transactional(readOnly = true)
    public NoticeDetailDto getNoticeDetail(@NonNull Long id) {
        Notice n = noticeRepository.findById(id).orElse(null);
        if (n == null) return null;

        noticeViewService.recordView(id, securityUtils.currentUsername(), n.getAuthorUsername());

        return NoticeDetailDto.of(n, attachmentService.listFor(id));
    }

    @Transactional(readOnly = true)
    public NoticeNeighborsDto getNeighbors(@NonNull Long id) {
        return new NoticeNeighborsDto(
                NoticeNeighborsDto.Neighbor.of(
                        noticeRepository.findFirstByIdLessThanOrderByIdDesc(id).orElse(null)),
                NoticeNeighborsDto.Neighbor.of(
                        noticeRepository.findFirstByIdGreaterThanOrderByIdAsc(id).orElse(null)));
    }

    /** 상단 고정 토글. 컨트롤러에서 관리자만 들어온다. */
    public ResponseEntity<?> setPinned(@NonNull Long id, boolean pinned) {
        return noticeRepository.findById(id)
                .map((@NonNull Notice n) -> {
                    n.setPinned(pinned);
                    return ResponseEntity.ok(Map.of("pinned", noticeRepository.save(n).isPinned()));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    public NoticeDetailDto createNotice(String title, String content, NoticeCategory category, boolean pinned,
                                        List<Long> attachmentIds) {
        // 컨트롤러의 @PreAuthorize와 중복이지만, 공지 생성은 예전에 권한 검사가
        // 아예 없어 일반 사용자도 API 직접 호출로 글을 쓸 수 있었다. 서비스단에도 남겨 둔다.
        if (!securityUtils.isAdmin()) {
            throw new AccessDeniedException("공지 작성 권한이 없습니다.");
        }
        Notice n = new Notice();
        n.setTitle(title);
        n.setCategory(category == null ? NoticeCategory.GENERAL : category);
        n.setPinned(pinned);
        applyContent(n, content);
        n.setAuthorUsername(securityUtils.currentUsernameOrThrow());
        n.setAuthorDisplayName(securityUtils.currentUserDisplayName());

        Notice saved = noticeRepository.save(n);
        attachmentService.claim(saved, attachmentIds, saved.getContent());
        // 첨부는 저장 직후에 붙으므로, 목록을 다시 읽어 응답에 담는다
        return NoticeDetailDto.of(saved, attachmentService.listFor(saved.getId()));
    }

    public ResponseEntity<?> updateNotice(@NonNull Long id, String title, String content,
                                          NoticeCategory category, boolean pinned,
                                          List<Long> attachmentIds) {
        String me = securityUtils.currentUsername();
        boolean admin = securityUtils.isAdmin();
        return noticeRepository.findById(id)
                .map((@NonNull Notice n) -> {
                    if (!admin && !n.getAuthorUsername().equals(me)) {
                        return ResponseEntity.status(403).body(FORBIDDEN_BODY);
                    }
                    n.setTitle(title);
                    n.setCategory(category == null ? NoticeCategory.GENERAL : category);
                    n.setPinned(pinned);
                    applyContent(n, content);

                    Notice saved = noticeRepository.save(n);
                    attachmentService.claim(saved, attachmentIds, saved.getContent());
                    return ResponseEntity.ok(NoticeDetailDto.of(saved, attachmentService.listFor(saved.getId())));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * 본문을 정리해 저장 형태로 만든다.
     *
     * 저장되는 것은 새니타이징을 통과한 HTML이고, 검색은 거기서 태그를 걷어낸
     * 평문 사본에 건다. 저장을 거친 글은 형식이 HTML로 승격되므로, 예전 평문 글도
     * 한 번 수정하면 리치 텍스트로 넘어간다.
     */
    private void applyContent(Notice n, String content) {
        String safe = sanitizer.sanitize(content);
        String plain = sanitizer.toPlainText(safe);

        // @NotBlank는 "<p><br></p>"(에디터의 빈 문서)를 통과시킨다.
        // 글자도 없고 이미지도 없으면 빈 글로 본다.
        if (plain.isBlank() && !safe.contains("<img")) {
            throw new IllegalArgumentException("내용을 입력해주세요");
        }
        if (safe.length() > MAX_CONTENT_LENGTH) {
            throw new IllegalArgumentException("본문이 너무 깁니다");
        }

        n.setContent(safe);
        n.setContentText(plain);
        n.setContentFormat(NoticeContentFormat.HTML);
    }

    public ResponseEntity<?> deleteNotice(@NonNull Long id) {
        String me = securityUtils.currentUsername();
        boolean admin = securityUtils.isAdmin();
        return noticeRepository.findById(id)
                .map((@NonNull Notice n) -> {
                    if (!admin && !n.getAuthorUsername().equals(me)) {
                        return ResponseEntity.status(403).body(FORBIDDEN_BODY);
                    }
                    // DB 행은 CASCADE가 정리하지만 디스크 파일은 우리가 치워야 한다
                    attachmentService.deleteFilesOf(id);
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
                        return ResponseEntity.status(403).body(FORBIDDEN_BODY);
                    }
                    commentRepository.delete(c);
                    return ResponseEntity.ok(Map.of("deleted", true));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
