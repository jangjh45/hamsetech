package com.hamsetech.hamsetech.work;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface OvertimeRecordRepository extends JpaRepository<OvertimeRecord, Long>,
        JpaSpecificationExecutor<OvertimeRecord> {

    List<OvertimeRecord> findByUserIdOrderByWorkDateDesc(Long userId);

    List<OvertimeRecord> findByUserIdAndWorkDateBetweenOrderByWorkDateDesc(Long userId, LocalDate from, LocalDate to);

    List<OvertimeRecord> findByStatusAndWorkDateBetween(OvertimeRecord.Status status, LocalDate from, LocalDate to);

    /** 일괄 등록 시 이미 같은 날 같은 구분으로 등록된 직원을 걸러내는 데 쓴다. */
    List<OvertimeRecord> findByWorkDateAndTypeAndUserIdIn(LocalDate workDate, OvertimeType type,
                                                          Collection<Long> userIds);
}
