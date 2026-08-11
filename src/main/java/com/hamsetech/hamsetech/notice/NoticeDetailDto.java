package com.hamsetech.hamsetech.notice;

import java.time.Instant;
import java.util.List;

/**
 * 상세 화면.
 *
 * contentFormat을 함께 내려보내야 프론트가 평문과 HTML을 구분해 그릴 수 있다.
 * 이게 없으면 WYSIWYG 도입 전에 쓴 글이 한 줄로 뭉개진다.
 */
public record NoticeDetailDto(
        Long id,
        String title,
        String content,
        NoticeContentFormat contentFormat,
        NoticeCategory category,
        boolean pinned,
        long viewCount,
        String authorUsername,
        String authorDisplayName,
        Instant createdAt,
        Instant updatedAt,
        List<NoticeAttachmentDto> attachments) {

    public static NoticeDetailDto of(Notice n) {
        return of(n, List.of());
    }

    public static NoticeDetailDto of(Notice n, List<NoticeAttachmentDto> attachments) {
        return new NoticeDetailDto(
                n.getId(),
                n.getTitle(),
                n.getContent(),
                n.getContentFormat(),
                n.getCategory(),
                n.isPinned(),
                n.getViewCount(),
                n.getAuthorUsername(),
                n.getAuthorDisplayName(),
                n.getCreatedAt(),
                n.getUpdatedAt(),
                attachments);
    }
}
