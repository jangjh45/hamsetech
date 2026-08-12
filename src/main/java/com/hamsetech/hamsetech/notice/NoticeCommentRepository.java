package com.hamsetech.hamsetech.notice;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface NoticeCommentRepository extends JpaRepository<NoticeComment, Long> {

    List<NoticeComment> findByNoticeIdOrderByCreatedAtAsc(Long noticeId);

    /**
     * 목록 화면의 댓글 수 배지용. 글마다 count를 날리면 페이지당 10번이 되므로
     * 현재 페이지의 id를 한 번에 묶어 그룹 카운트로 받는다.
     */
    @Query("select c.notice.id, count(c) from NoticeComment c where c.notice.id in :ids group by c.notice.id")
    List<Object[]> countByNoticeIds(@Param("ids") Collection<Long> ids);
}
