package com.hamsetech.hamsetech.notice;

import org.springframework.data.domain.Page;

import java.util.List;

/**
 * 목록 응답.
 *
 * 고정 공지를 페이징 안에 섞지 않고 따로 내려보낸다. 섞어 놓으면 화면의 글 번호
 * (전체 건수에서 역순으로 세는 방식)가 어긋나고, 이전·다음 글도 "다음 글이 3년 전 공지"
 * 같은 결과가 된다. pinned는 첫 페이지에서만 채우고 2페이지부터는 빈 배열이다.
 */
public record NoticeListResponse(List<NoticeSummaryDto> pinned, PageDto page) {

    /**
     * Spring의 Page를 그대로 직렬화하면 구조가 버전에 따라 흔들린다는 경고가 붙는다.
     * 프론트가 이미 쓰고 있는 필드만 고정해서 내려보낸다.
     */
    public record PageDto(
            List<NoticeSummaryDto> content,
            long totalElements,
            int totalPages,
            int number,
            int size) {

        public static PageDto of(Page<?> page, List<NoticeSummaryDto> content) {
            return new PageDto(
                    content,
                    page.getTotalElements(),
                    page.getTotalPages(),
                    page.getNumber(),
                    page.getSize());
        }
    }
}
