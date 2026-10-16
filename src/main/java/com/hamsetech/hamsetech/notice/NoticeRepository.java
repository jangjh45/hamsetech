package com.hamsetech.hamsetech.notice;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface NoticeRepository extends JpaRepository<Notice, Long>, JpaSpecificationExecutor<Notice> {

    long countByPinnedTrue();

    /**
     * 조회수 증가. 엔티티를 읽어 setter로 올리면 동시 조회 시 서로 덮어쓴다.
     * coalesce는 백필 전 NULL을 방어한다.
     */
    @Modifying
    @Query("update Notice n set n.viewCount = coalesce(n.viewCount, 0) + 1 where n.id = :id")
    int incrementViewCount(@Param("id") Long id);
}
