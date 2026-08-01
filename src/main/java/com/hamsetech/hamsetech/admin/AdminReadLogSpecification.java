package com.hamsetech.hamsetech.admin;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public class AdminReadLogSpecification {

    public static Specification<AdminReadLog> withFilters(
            String adminUsername,
            AdminLog.EntityType entityType,
            Instant startDate,
            Instant endDate) {

        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (adminUsername != null && !adminUsername.trim().isEmpty()) {
                predicates.add(criteriaBuilder.like(
                        root.get("adminUsername"),
                        "%" + adminUsername.trim() + "%"
                ));
            }
            if (entityType != null) {
                predicates.add(criteriaBuilder.equal(root.get("entityType"), entityType));
            }
            if (startDate != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("timestamp"), startDate));
            }
            if (endDate != null) {
                predicates.add(criteriaBuilder.lessThanOrEqualTo(root.get("timestamp"), endDate));
            }

            // 정렬은 호출부의 Pageable(Sort)에서 지정한다.
            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };
    }
}
