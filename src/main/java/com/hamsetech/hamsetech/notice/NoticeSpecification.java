package com.hamsetech.hamsetech.notice;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

public class NoticeSpecification {

    /**
     * 목록 필터.
     *
     * 검색어는 제목·본문·작성자에 모두 건다. 화면에는 "제목 · 작성자 검색"이라고
     * 적혀 있었지만 실제로는 제목만 찾고 있었다.
     *
     * 본문은 content(HTML)가 아니라 contentText(평문 사본)를 본다. HTML을 그대로
     * 검색하면 태그와 스타일 값이 걸려 "color"로 검색했을 때 글자색을 넣은 글이
     * 전부 나온다.
     */
    public static Specification<Notice> withFilters(String q, NoticeCategory category, Boolean pinned) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (q != null && !q.trim().isEmpty()) {
                String like = "%" + q.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("title")), like),
                        cb.like(cb.lower(root.get("contentText")), like),
                        cb.like(cb.lower(root.get("authorDisplayName")), like),
                        cb.like(cb.lower(root.get("authorUsername")), like)
                ));
            }
            if (category != null) {
                predicates.add(cb.equal(root.get("category"), category));
            }
            if (pinned != null) {
                // 백필 전 NULL 행이 남아 있어도 일반글로 잡히도록 NULL을 false로 취급한다.
                predicates.add(pinned
                        ? cb.isTrue(root.get("pinned"))
                        : cb.or(cb.isFalse(root.get("pinned")), cb.isNull(root.get("pinned"))));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
