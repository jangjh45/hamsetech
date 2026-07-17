package com.hamsetech.hamsetech.work;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class OvertimeRecordSpecification {

    public static Specification<OvertimeRecord> withFilters(
            String username,
            OvertimeType type,
            OvertimeRecord.Status status,
            LocalDate from,
            LocalDate to) {

        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (username != null && !username.trim().isEmpty()) {
                predicates.add(criteriaBuilder.like(
                        root.get("username"),
                        "%" + username.trim() + "%"
                ));
            }
            if (type != null) {
                predicates.add(criteriaBuilder.equal(root.get("type"), type));
            }
            if (status != null) {
                predicates.add(criteriaBuilder.equal(root.get("status"), status));
            }
            if (from != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("workDate"), from));
            }
            if (to != null) {
                predicates.add(criteriaBuilder.lessThanOrEqualTo(root.get("workDate"), to));
            }
            if (query != null) {
                query.orderBy(criteriaBuilder.desc(root.get("workDate")));
            }

            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };
    }
}
