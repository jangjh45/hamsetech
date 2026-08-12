package com.hamsetech.hamsetech.notice;

/** 상세 화면 아래의 이전·다음 글. 제목만 있으면 되므로 본문은 싣지 않는다. */
public record NoticeNeighborsDto(Neighbor prev, Neighbor next) {

    public record Neighbor(Long id, String title) {
        public static Neighbor of(Notice n) {
            return n == null ? null : new Neighbor(n.getId(), n.getTitle());
        }
    }
}
