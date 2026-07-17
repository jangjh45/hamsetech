package com.hamsetech.hamsetech.work;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDate;
import java.util.List;

public interface OvertimeRecordRepository extends JpaRepository<OvertimeRecord, Long>,
        JpaSpecificationExecutor<OvertimeRecord> {

    List<OvertimeRecord> findByUserIdOrderByWorkDateDesc(Long userId);

    List<OvertimeRecord> findByUserIdAndWorkDateBetweenOrderByWorkDateDesc(Long userId, LocalDate from, LocalDate to);

    List<OvertimeRecord> findByStatusAndWorkDateBetween(OvertimeRecord.Status status, LocalDate from, LocalDate to);
}
