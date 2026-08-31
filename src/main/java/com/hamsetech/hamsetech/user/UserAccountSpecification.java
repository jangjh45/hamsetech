package com.hamsetech.hamsetech.user;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class UserAccountSpecification {

    /**
     * 관리자 사용자 목록 필터.
     *
     * 예전에는 전체 사용자를 메모리에 올린 뒤 스트림으로 걸렀다. 계정 수가 늘수록
     * 목록 화면 한 번에 테이블을 통째로 읽는다.
     *
     * @param status null이면 상태 필터를 적용하지 않는다. 호출부가 알 수 없는 값을
     *               null로 바꿔 넘기므로, 잘못된 status 파라미터는 전체 조회가 된다.
     */
    public static Specification<UserAccount> withFilters(String q, UserStatus status) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (q != null && !q.trim().isEmpty()) {
                String like = "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("username")), like),
                        cb.like(cb.lower(root.get("displayName")), like)
                ));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
