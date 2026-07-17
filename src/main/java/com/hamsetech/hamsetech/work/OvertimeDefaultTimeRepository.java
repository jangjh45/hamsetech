package com.hamsetech.hamsetech.work;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OvertimeDefaultTimeRepository extends JpaRepository<OvertimeDefaultTime, Long> {

    Optional<OvertimeDefaultTime> findByType(OvertimeType type);
}
