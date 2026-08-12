package com.hamsetech.hamsetech.notice;

import java.time.Instant;

/**
 * 목록 한 줄.
 *
 * content를 일부러 뺐다. 예전에는 엔티티를 그대로 내려보내 목록 응답에 본문 전체가
 * 실렸는데, 본문이 HTML이 되면서 이미지 태그까지 붙어 목록이 훨씬 무거워진다.
 */
public record NoticeSummaryDto(
        Long id,
        String title,
        NoticeCategory category,
        boolean pinned,
        long viewCount,
        String authorUsername,
        String authorDisplayName,
        Instant createdAt,
        Instant updatedAt,
        int commentCount,
        int attachmentCount) {

    public static NoticeSummaryDto of(Notice n, int commentCount, int attachmentCount) {
        return new NoticeSummaryDto(
                n.getId(),
                n.getTitle(),
                n.getCategory(),
                n.isPinned(),
                n.getViewCount(),
                n.getAuthorUsername(),
                n.getAuthorDisplayName(),
                n.getCreatedAt(),
                n.getUpdatedAt(),
                commentCount,
                attachmentCount);
    }
}
