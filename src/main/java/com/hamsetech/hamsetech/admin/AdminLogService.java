package com.hamsetech.hamsetech.admin;

import com.hamsetech.hamsetech.security.SecurityUtils;
import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Service
public class AdminLogService {

    private final AdminLogRepository adminLogRepository;
    private final AdminReadLogWriter readLogWriter;
    private final UserAccountRepository userAccountRepository;
    private final SecurityUtils securityUtils;

    public AdminLogService(AdminLogRepository adminLogRepository,
                           AdminReadLogWriter readLogWriter,
                           UserAccountRepository userAccountRepository,
                           SecurityUtils securityUtils) {
        this.adminLogRepository = adminLogRepository;
        this.readLogWriter = readLogWriter;
        this.userAccountRepository = userAccountRepository;
        this.securityUtils = securityUtils;
    }

    /**
     * 현재 사용자가 관리자 권한을 가지고 있는지 확인.
     * 권한 판정은 SecurityUtils 한 곳에만 둔다 — 판정 코드가 두 벌이면
     * 한쪽만 고쳐지는 사고가 난다.
     */
    public boolean isAdminUser() {
        return securityUtils.isAdmin();
    }

    /**
     * 현재 사용자 정보를 가져옴
     */
    public UserAccount getCurrentUser() {
        return userAccountRepository.findByUsername(securityUtils.currentUsername()).orElse(null);
    }

    /**
     * 현재 사용자의 이름을 가져옴
     */
    public String getCurrentUsername() {
        return securityUtils.currentUsername();
    }

    /**
     * 관리자 로그를 기록 (관리자 권한이 있는 경우에만)
     */
    @Transactional
    public void logAdminAction(AdminLog.Action action, AdminLog.EntityType entityType, Long entityId, String details) {
        if (!isAdminUser()) {
            return; // 관리자가 아니면 로깅하지 않음
        }

        save(getCurrentUsername(), action, entityType, entityId, details);
    }

    /**
     * 관리자 로그를 기록 (관리자 권한 체크 없이 강제 기록 - 시스템 이벤트용)
     */
    @Transactional
    public void logSystemAction(String adminUsername, AdminLog.Action action, AdminLog.EntityType entityType, Long entityId, String details) {
        save(adminUsername, action, entityType, entityId, details);
    }

    /**
     * 조회(READ)는 admin_read_logs, 나머지 변경 작업은 admin_logs에 저장한다.
     *
     * IP는 여기서 뽑는다. 조회 로그는 다른 스레드에서 저장되는데, 그쪽에는
     * 요청 컨텍스트가 없어 IP를 알아낼 방법이 없다.
     */
    private void save(String adminUsername, AdminLog.Action action, AdminLog.EntityType entityType, Long entityId, String details) {
        String ipAddress = currentIpAddress();

        if (action == AdminLog.Action.READ) {
            // 목록·상세 조회 전부가 이 경로다. 요청 하나마다 INSERT를 기다리게 하지 않는다.
            readLogWriter.write(adminUsername, entityType, entityId, details, ipAddress);
            return;
        }

        // 변경 로그는 동기로 남긴다. 양이 적고, 실패했다면 바로 드러나는 편이 낫다.
        AdminLog log = new AdminLog(adminUsername, action, entityType, entityId);
        log.setDetails(details);
        log.setIpAddress(ipAddress);
        adminLogRepository.save(log);
    }

    /**
     * 현재 요청의 클라이언트 IP (HTTP 요청 컨텍스트가 없으면 null)
     */
    private String currentIpAddress() {
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.currentRequestAttributes();
            HttpServletRequest request = attrs.getRequest();
            return getClientIpAddress(request);
        } catch (Exception e) {
            // HTTP 요청 컨텍스트를 사용할 수 없는 경우 무시 (배치/스케줄러 등)
            return null;
        }
    }

    /**
     * 클라이언트 IP 주소 추출.
     *
     * X-Forwarded-For 같은 헤더를 직접 읽지 않는다. 클라이언트가 마음대로 붙일 수
     * 있는 값이라, 그걸 믿으면 감사 로그의 IP를 공격자가 원하는 값으로 위조할 수
     * 있다. 프록시 뒤에 있을 때는 server.forward-headers-strategy 설정으로 Spring이
     * 신뢰 가능한 경로에서만 헤더를 반영하게 하고, 여기서는 그 결과만 읽는다.
     */
    private String getClientIpAddress(HttpServletRequest request) {
        return request.getRemoteAddr();
    }
}
