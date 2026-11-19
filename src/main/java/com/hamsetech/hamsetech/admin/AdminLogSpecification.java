package com.hamsetech.hamsetech.admin;

import org.springframework.data.jpa.domain.Specification;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public class AdminLogSpecification {

    public static Specification<AdminLog> withFilters(
            String adminUsername,
            AdminLog.EntityType entityType,
            AdminLog.Action action,
            Instant startDate,
            Instant endDate) {
        
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            // 관리자명 필터 (LIKE 검색)
            if (adminUsername != null && !adminUsername.trim().isEmpty()) {
                predicates.add(criteriaBuilder.like(
                    root.get("adminUsername"), 
                    "%" + adminUsername.trim() + "%"
                ));
            }

            // 엔티티 타입 필터
            if (entityType != null) {
                predicates.add(criteriaBuilder.equal(root.get("entityType"), entityType));
            }

            // 작업 필터
            if (action != null) {
                predicates.add(criteriaBuilder.equal(root.get("action"), action));
            }

            // 시작 날짜 필터
            if (startDate != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(
                    root.get("timestamp"), 
                    startDate
                ));
            }

            // 종료 날짜 필터
            if (endDate != null) {
                predicates.add(criteriaBuilder.lessThan(
                    root.get("timestamp"), 
                    endDate
                ));
            }

            // 정렬은 호출부의 Pageable(Sort)에서 지정한다.
            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };
    }
}

