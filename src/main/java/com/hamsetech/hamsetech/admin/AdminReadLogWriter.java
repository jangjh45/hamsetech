package com.hamsetech.hamsetech.admin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 조회(READ) 감사 로그를 요청 경로 밖에서 저장한다.
 *
 * &#64;AdminLoggable(action = READ)가 붙은 엔드포인트는 목록·상세 조회 전부다. 즉
 * 읽기 요청 하나마다 INSERT가 한 번씩 따라붙어, 사용자가 기다리는 시간에 쓰기
 * 지연이 그대로 얹혔다.
 *
 * 변경(CREATE/UPDATE/DELETE) 로그는 동기로 남긴다. 양이 적고, 무엇보다 그 기록이
 * 실패했다는 사실 자체가 바로 드러나는 편이 낫다. 비동기로 미루는 것은 양이 많고
 * 유실 위험을 감수할 수 있는 조회 쪽뿐이다.
 *
 * 값은 전부 호출한 스레드에서 이미 뽑아 넘겨받는다. 여기서 RequestContextHolder를
 * 읽으면 요청 스레드가 아니라 아무것도 없다.
 */
@Component
public class AdminReadLogWriter {

    private static final Logger logger = LoggerFactory.getLogger(AdminReadLogWriter.class);

    private final AdminReadLogRepository repository;

    public AdminReadLogWriter(AdminReadLogRepository repository) {
        this.repository = repository;
    }

    /**
     * 실행기가 가득 차면 호출한 스레드가 직접 저장한다(CallerRunsPolicy).
     * 감사 기록은 버리는 것보다 느려지는 편이 낫다는 판단이다.
     *
     * REQUIRES_NEW로 트랜잭션을 새로 연다. 비동기 스레드에는 물려받을 트랜잭션이
     * 없고, 로그 저장이 조회 트랜잭션에 얹히면 안 된다.
     */
    @Async(AdminLogAsyncConfig.READ_LOG_EXECUTOR)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(String adminUsername, AdminLog.EntityType entityType, Long entityId,
                      String details, String ipAddress) {
        try {
            AdminReadLog readLog = new AdminReadLog(adminUsername, entityType, entityId);
            readLog.setDetails(details);
            readLog.setIpAddress(ipAddress);
            repository.save(readLog);
        } catch (Exception e) {
            // 비동기 경로라 여기서 던져도 받아 줄 곳이 없다. 조회 자체는 이미 끝났고,
            // 조회 로그가 한 줄 빠졌다고 요청을 실패시킬 이유도 없다.
            logger.warn("Failed to record read log (user={}, entityType={}, entityId={})",
                    adminUsername, entityType, entityId, e);
        }
    }
}
