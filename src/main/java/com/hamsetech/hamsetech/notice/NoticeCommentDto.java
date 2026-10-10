package com.hamsetech.hamsetech.notice;

import java.time.Instant;

public record NoticeCommentDto(
        Long id,
        String content,
        String authorUsername,
        String authorDisplayName,
        String authorAvatarUrl,
        Long parentId,
        Instant createdAt) {}
