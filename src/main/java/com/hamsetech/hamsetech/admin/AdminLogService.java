package com.hamsetech.hamsetech.admin;

import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Service
public class AdminLogService {

    private final AdminLogRepository adminLogRepository;
    private final AdminReadLogRepository adminReadLogRepository;
    private final UserAccountRepository userAccountRepository;

    public AdminLogService(AdminLogRepository adminLogRepository,
                           AdminReadLogRepository adminReadLogRepository,
                           UserAccountRepository userAccountRepository) {
        this.adminLogRepository = adminLogRepository;
        this.adminReadLogRepository = adminReadLogRepository;
        this.userAccountRepository = userAccountRepository;
    }

    /**
     * 현재 사용자가 관리자 권한을 가지고 있는지 확인
     */
    public boolean isAdminUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;

        for (GrantedAuthority ga : auth.getAuthorities()) {
            if ("ROLE_ADMIN".equals(ga.getAuthority()) || "ROLE_SUPER_ADMIN".equals(ga.getAuthority())) {
                return true;
            }
        }
        return false;
    }

    /**
     * 현재 사용자 정보를 가져옴
     */
    public UserAccount getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            return null;
        }
        return userAccountRepository.findByUsername(auth.getName()).orElse(null);
    }

    /**
     * 현재 사용자의 이름을 가져옴
     */
    public String getCurrentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : "anonymous";
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
     */
    private void save(String adminUsername, AdminLog.Action action, AdminLog.EntityType entityType, Long entityId, String details) {
        String ipAddress = currentIpAddress();

        if (action == AdminLog.Action.READ) {
            AdminReadLog readLog = new AdminReadLog(adminUsername, entityType, entityId);
            readLog.setDetails(details);
            readLog.setIpAddress(ipAddress);
            adminReadLogRepository.save(readLog);
            return;
        }

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
     * 클라이언트 IP 주소 추출
     */
    private String getClientIpAddress(HttpServletRequest request) {
        String ipAddress = request.getHeader("X-Forwarded-For");
        if (ipAddress == null || ipAddress.isEmpty() || "unknown".equalsIgnoreCase(ipAddress)) {
            ipAddress = request.getHeader("Proxy-Client-IP");
        }
        if (ipAddress == null || ipAddress.isEmpty() || "unknown".equalsIgnoreCase(ipAddress)) {
            ipAddress = request.getHeader("WL-Proxy-Client-IP");
        }
        if (ipAddress == null || ipAddress.isEmpty() || "unknown".equalsIgnoreCase(ipAddress)) {
            ipAddress = request.getHeader("HTTP_CLIENT_IP");
        }
        if (ipAddress == null || ipAddress.isEmpty() || "unknown".equalsIgnoreCase(ipAddress)) {
            ipAddress = request.getHeader("HTTP_X_FORWARDED_FOR");
        }
        if (ipAddress == null || ipAddress.isEmpty() || "unknown".equalsIgnoreCase(ipAddress)) {
            ipAddress = request.getRemoteAddr();
        }
        return ipAddress;
    }
}
