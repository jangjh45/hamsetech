package com.hamsetech.hamsetech.notice;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 조회수 집계.
 *
 * 상세 조회(읽기)가 쓰기를 유발하는 구조라, 여기서 실패하면 공지를 못 보게 된다.
 * REQUIRES_NEW로 트랜잭션을 떼어내고 호출부에서 예외를 삼켜, 집계가 깨져도
 * 본문 조회에는 영향이 없게 한다.
 */
@Service
public class NoticeViewService {

    private static final Logger logger = LoggerFactory.getLogger(NoticeViewService.class);

    private final NoticeViewRepository viewRepository;
    private final NoticeRepository noticeRepository;
    private final int windowHours;

    public NoticeViewService(NoticeViewRepository viewRepository,
                             NoticeRepository noticeRepository,
                             @Value("${app.notice.view-window-hours:6}") int windowHours) {
        this.viewRepository = viewRepository;
        this.noticeRepository = noticeRepository;
        this.windowHours = windowHours;
    }

    /** 새 조회일 때만 조회수를 1 올린다. 실패는 로그만 남기고 넘어간다. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordView(Long noticeId, String username, String authorUsername) {
        if (noticeId == null || username == null || username.isBlank()) return;
        // 작성자가 자기 글을 여는 것은 조회로 치지 않는다.
        if (username.equals(authorUsername)) return;

        try {
            if (viewRepository.touch(noticeId, username, windowHours) > 0) {
                noticeRepository.incrementViewCount(noticeId);
            }
        } catch (Exception e) {
            logger.warn("Failed to record notice view (noticeId={}, username={})", noticeId, username, e);
        }
    }
}
