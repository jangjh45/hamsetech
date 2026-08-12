package com.hamsetech.hamsetech.notice;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface NoticeRepository extends JpaRepository<Notice, Long>, JpaSpecificationExecutor<Notice> {

    /**
     * 이전·다음 글.
     *
     * 예전에는 목록 API를 size=50으로 다시 불러 인덱스로 찾았는데, 51번째부터는
     * 스캔 범위 밖이라 이웃을 못 찾았다. 고정글 정렬과도 엮이지 않도록
     * 순수 작성 순서(id)만 본다.
     */
    Optional<Notice> findFirstByIdLessThanOrderByIdDesc(Long id);
    Optional<Notice> findFirstByIdGreaterThanOrderByIdAsc(Long id);

    /**
     * 조회수 증가. 엔티티를 읽어 setter로 올리면 동시 조회 시 서로 덮어쓴다.
     * coalesce는 백필 전 NULL을 방어한다.
     */
    @Modifying
    @Query("update Notice n set n.viewCount = coalesce(n.viewCount, 0) + 1 where n.id = :id")
    int incrementViewCount(@Param("id") Long id);
}
