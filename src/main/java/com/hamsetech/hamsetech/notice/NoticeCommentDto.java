package com.hamsetech.hamsetech.notice;

import java.time.Instant;

public record NoticeCommentDto(Long id, String content, String authorUsername, Long parentId, Instant createdAt) {}
