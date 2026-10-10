package com.hamsetech.hamsetech.work;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

public interface OvertimeRecordRepository extends JpaRepository<OvertimeRecord, Long>,
        JpaSpecificationExecutor<OvertimeRecord> {

    /** PENDING일 때만 승인한다. 버전을 함께 올려 오래된 엔티티의 후속 저장도 충돌시킨다. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update OvertimeRecord r
            set r.status = :approved, r.approverUsername = :approver,
                r.approvedAt = :now, r.rejectReason = null,
                r.updatedAt = :now, r.version = r.version + 1
            where r.id = :id and r.status = :pending
            """)
    int approveIfPending(@Param("id") Long id,
                         @Param("approver") String approver,
                         @Param("now") java.time.Instant now,
                         @Param("pending") OvertimeRecord.Status pending,
                         @Param("approved") OvertimeRecord.Status approved);

    /** PENDING일 때만 반려한다. 동시 승인·반려 중 DB에서 먼저 성공한 하나만 반영된다. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update OvertimeRecord r
            set r.status = :rejected, r.approverUsername = :approver,
                r.approvedAt = :now, r.rejectReason = :reason,
                r.updatedAt = :now, r.version = r.version + 1
            where r.id = :id and r.status = :pending
            """)
    int rejectIfPending(@Param("id") Long id,
                        @Param("approver") String approver,
                        @Param("now") java.time.Instant now,
                        @Param("reason") String reason,
                        @Param("pending") OvertimeRecord.Status pending,
                        @Param("rejected") OvertimeRecord.Status rejected);

    List<OvertimeRecord> findByUserIdOrderByWorkDateDesc(Long userId);

    List<OvertimeRecord> findByUserIdAndWorkDateBetweenOrderByWorkDateDesc(Long userId, LocalDate from, LocalDate to);

    /** 일괄 등록 시 이미 같은 날 같은 구분으로 등록된 직원을 걸러내는 데 쓴다. */
    List<OvertimeRecord> findByWorkDateAndTypeAndUserIdIn(LocalDate workDate, OvertimeType type,
                                                          Collection<Long> userIds);

    /**
     * 기간 집계. 직원·구분별 합계만 DB에서 받아 온다.
     *
     * 예전에는 승인 기록을 전부 메모리에 올린 뒤 Java로 더했다. 집계 화면과 엑셀
     * 내보내기가 쓰는 경로라, 기록이 쌓일수록 행 수에 그대로 비례해 무거워졌다.
     *
     * displayName은 max로 고른다. 같은 username의 행들이 서로 다른 표시 이름을
     * 가질 수 있는데(중간에 이름을 바꾼 경우), 예전 구현은 "먼저 읽힌 행"의 것을
     * 썼으므로 어차피 순서에 기대고 있었다. max는 최소한 결정적이다.
     */
    @Query("""
            select new com.hamsetech.hamsetech.work.OvertimeTypeTotal(
                    r.username, max(r.displayName), r.type, sum(r.totalMinutes), count(r))
            from OvertimeRecord r
            where r.status = :status and r.workDate between :from and :to
            group by r.username, r.type
            order by r.username
            """)
    List<OvertimeTypeTotal> summarizeByUserAndType(@Param("status") OvertimeRecord.Status status,
                                                    @Param("from") LocalDate from,
                                                    @Param("to") LocalDate to);
}
