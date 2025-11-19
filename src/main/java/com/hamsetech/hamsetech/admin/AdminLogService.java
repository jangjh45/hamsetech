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
    private final UserAccountRepository userAccountRepository;

    public AdminLogService(AdminLogRepository adminLogRepository, UserAccountRepository userAccountRepository) {
        this.adminLogRepository = adminLogRepository;
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

        String username = getCurrentUsername();
        // entityId가 null인 경우 0L로 설정 (목록 조회 등의 경우)
        Long safeEntityId = (entityId != null) ? entityId : 0L;
        AdminLog log = new AdminLog(username, action, entityType, safeEntityId);
        log.setDetails(details);

        // IP 주소 추출 (선택사항)
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.currentRequestAttributes();
            HttpServletRequest request = attrs.getRequest();
            String ipAddress = getClientIpAddress(request);
            log.setIpAddress(ipAddress);
        } catch (Exception e) {
            // IP 주소 추출 실패 시 무시
        }

        adminLogRepository.save(log);
    }

    /**
     * 관리자 로그를 기록 (관리자 권한 체크 없이 강제 기록 - 시스템 이벤트용)
     */
    @Transactional
    public void logSystemAction(String adminUsername, AdminLog.Action action, AdminLog.EntityType entityType, Long entityId, String details) {
        // entityId가 null인 경우 0L로 설정 (목록 조회 등의 경우)
        Long safeEntityId = (entityId != null) ? entityId : 0L;
        AdminLog log = new AdminLog(adminUsername, action, entityType, safeEntityId);
        log.setDetails(details);
        adminLogRepository.save(log);
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
