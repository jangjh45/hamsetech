package com.hamsetech.hamsetech.notice;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface NoticeAttachmentRepository extends JpaRepository<NoticeAttachment, Long> {

    List<NoticeAttachment> findByNoticeIdOrderByIdAsc(Long noticeId);

    /** 글을 저장하지 않고 나가 주인 없이 남은 첨부. */
    List<NoticeAttachment> findByNoticeIsNullAndCreatedAtBefore(Instant cutoff);

    /** 목록 화면의 첨부 배지용. 댓글 수와 같은 이유로 한 번에 묶어 센다. */
    @Query("select a.notice.id, count(a) from NoticeAttachment a " +
           "where a.notice.id in :ids and a.kind = com.hamsetech.hamsetech.notice.AttachmentKind.FILE " +
           "group by a.notice.id")
    List<Object[]> countFilesByNoticeIds(@Param("ids") Collection<Long> ids);
}
