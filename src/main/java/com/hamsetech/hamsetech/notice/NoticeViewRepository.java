package com.hamsetech.hamsetech.notice;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NoticeViewRepository extends JpaRepository<NoticeView, Long> {

    /**
     * 조회 기록을 남기고, 그것이 "새 조회"였는지 알려준다.
     *
     * 같은 사람이 새로고침을 눌러도 windowHours 안에서는 UPDATE의 WHERE에 걸려
     * 0행이 갱신되고, 그때는 조회수를 올리지 않는다. React StrictMode가 이펙트를
     * 두 번 실행하는 것도 같은 창에서 흡수된다.
     *
     * @return 1이면 새 조회(조회수를 올려야 함), 0이면 창 안의 재방문
     */
    @Modifying
    @Query(value = """
            INSERT INTO notice_views (notice_id, username, last_viewed_at)
            VALUES (:noticeId, :username, now())
            ON CONFLICT (notice_id, username)
            DO UPDATE SET last_viewed_at = now()
            WHERE notice_views.last_viewed_at < now() - make_interval(hours => :windowHours)
            """, nativeQuery = true)
    int touch(@Param("noticeId") Long noticeId,
              @Param("username") String username,
              @Param("windowHours") int windowHours);
}
