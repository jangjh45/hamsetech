package com.hamsetech.hamsetech.notice;

import com.hamsetech.hamsetech.security.SecurityUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Transactional
public class NoticeAttachmentService {

    private static final Logger logger = LoggerFactory.getLogger(NoticeAttachmentService.class);

    /** 본문에 실제로 들어 있는 이미지를 찾아낸다. NoticeAttachmentDto.url과 짝이다. */
    private static final Pattern EMBEDDED_IMAGE =
            Pattern.compile("/api/notices/attachments/(\\d{1,19})/content");

    private final NoticeAttachmentRepository repository;
    private final AttachmentStorage storage;
    private final SecurityUtils securityUtils;

    public NoticeAttachmentService(NoticeAttachmentRepository repository,
                                   AttachmentStorage storage,
                                   SecurityUtils securityUtils) {
        this.repository = repository;
        this.storage = storage;
        this.securityUtils = securityUtils;
    }

    public NoticeAttachmentDto upload(MultipartFile file, AttachmentKind kind) {
        AttachmentStorage.Stored stored = storage.store(file, kind);

        NoticeAttachment a = new NoticeAttachment();
        a.setOriginalFilename(safeName(file.getOriginalFilename()));
        a.setStoredFilename(stored.storedFilename());
        a.setRelativePath(stored.relativePath());
        a.setContentType(stored.contentType());
        a.setFileSize(stored.size());
        a.setKind(kind);
        a.setUploaderUsername(securityUtils.currentUsername());

        // 저장이 롤백되면 디스크에만 파일이 남는다. 고아 정리가 나중에 회수한다.
        deleteFileIfRollback(stored.relativePath());

        return NoticeAttachmentDto.of(repository.save(a));
    }

    @Transactional(readOnly = true)
    public NoticeAttachment get(Long id) {
        return repository.findById(id).orElse(null);
    }

    @Transactional(readOnly = true)
    public List<NoticeAttachmentDto> listFor(Long noticeId) {
        return repository.findByNoticeIdOrderByIdAsc(noticeId).stream()
                .map(NoticeAttachmentDto::of)
                .toList();
    }

    /**
     * 글에 첨부를 확정한다.
     *
     * 본문 HTML에서 이미지 id를 직접 뽑아 합친다. 화면이 id 전달을 빠뜨려도
     * 본문에 박힌 이미지는 반드시 글에 붙어야 하기 때문이다.
     * 남의 미확정 첨부나 이미 다른 글에 속한 첨부는 건드리지 않는다.
     */
    public void claim(Notice notice, List<Long> requestedIds, String contentHtml) {
        String me = securityUtils.currentUsername();

        Set<Long> wanted = new LinkedHashSet<>();
        if (requestedIds != null) wanted.addAll(requestedIds);
        Matcher m = EMBEDDED_IMAGE.matcher(contentHtml == null ? "" : contentHtml);
        while (m.find()) {
            wanted.add(Long.parseLong(m.group(1)));
        }

        Set<Long> kept = new HashSet<>();
        for (Long id : wanted) {
            NoticeAttachment a = repository.findById(id).orElse(null);
            if (a == null) continue;

            if (a.getNotice() == null) {
                if (!a.getUploaderUsername().equals(me)) continue;   // 남이 올린 미확정 첨부
                a.setNotice(notice);
                repository.save(a);
                kept.add(id);
            } else if (a.getNotice().getId().equals(notice.getId())) {
                kept.add(id);
            }
            // 다른 글 소유는 그냥 무시한다
        }

        // 수정하면서 빠진 첨부는 지운다
        for (NoticeAttachment existing : repository.findByNoticeIdOrderByIdAsc(notice.getId())) {
            if (!kept.contains(existing.getId())) {
                removeWithFile(existing);
            }
        }
    }

    /** 글이 지워질 때 딸린 파일도 함께 치운다. DB 행은 CASCADE가 맡는다. */
    public void deleteFilesOf(Long noticeId) {
        for (NoticeAttachment a : repository.findByNoticeIdOrderByIdAsc(noticeId)) {
            deleteFileAfterCommit(a.getRelativePath());
        }
    }

    public boolean deleteById(Long id) {
        NoticeAttachment a = repository.findById(id).orElse(null);
        if (a == null) return false;
        removeWithFile(a);
        return true;
    }

    private void removeWithFile(NoticeAttachment a) {
        repository.delete(a);
        deleteFileAfterCommit(a.getRelativePath());
    }

    /**
     * 디스크 삭제는 커밋 뒤로 미룬다.
     *
     * 트랜잭션이 롤백돼도 지운 파일은 되돌릴 수 없다. 롤백 시 파일이 남는 쪽을
     * 택하고, 남은 파일은 고아 정리가 회수한다. 반대로 하면 그대로 데이터 유실이다.
     */
    private void deleteFileAfterCommit(String relativePath) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            storage.delete(relativePath);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                storage.delete(relativePath);
            }
        });
    }

    private void deleteFileIfRollback(String relativePath) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    storage.delete(relativePath);
                }
            }
        });
    }

    /** 원본 파일명은 화면 표시에만 쓰지만, 경로 구분자와 길이는 정리해 둔다. */
    private String safeName(String name) {
        if (name == null || name.isBlank()) return "download";
        String base = name.replace('\\', '/');
        int slash = base.lastIndexOf('/');
        if (slash >= 0) base = base.substring(slash + 1);
        base = base.replaceAll("[\\r\\n\"]", "").trim();
        if (base.isEmpty()) return "download";
        return base.length() > 200 ? base.substring(base.length() - 200) : base;
    }

    /** 미확정 첨부 정리. 스케줄러가 부른다. */
    public int purgeOrphans(java.time.Instant cutoff) {
        List<NoticeAttachment> orphans = repository.findByNoticeIsNullAndCreatedAtBefore(cutoff);
        List<String> paths = new ArrayList<>();
        for (NoticeAttachment a : orphans) {
            paths.add(a.getRelativePath());
            repository.delete(a);
        }
        for (String p : paths) {
            deleteFileAfterCommit(p);
        }
        if (!orphans.isEmpty()) {
            logger.info("Purged {} orphan notice attachment(s)", orphans.size());
        }
        return orphans.size();
    }
}
