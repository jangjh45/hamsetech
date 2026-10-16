package com.hamsetech.hamsetech.notice;

import java.util.List;

/** 한 페이지의 최상위 댓글 스레드와 그 답글들. */
public record NoticeCommentPageDto(
        List<NoticeCommentDto> content,
        long totalComments,
        long totalThreads,
        int totalPages,
        int number,
        int size) {}
