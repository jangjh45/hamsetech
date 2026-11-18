package com.hamsetech.hamsetech.auth;

import com.hamsetech.hamsetech.admin.AdminLog;
import com.hamsetech.hamsetech.admin.AdminLogService;
import com.hamsetech.hamsetech.security.LoginAttemptService;
import com.hamsetech.hamsetech.security.SessionPrincipal;
import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import com.hamsetech.hamsetech.user.UserRole;
import com.hamsetech.hamsetech.user.UserStatus;
import com.hamsetech.hamsetech.user.UserAvatarService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.http.CacheControl;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.csrf.CsrfToken;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    private final PasswordEncoder passwordEncoder;
    private final UserAccountRepository userRepository;
    private final AdminLogService adminLogService;
    private final LoginAttemptService loginAttemptService;
    private final SecurityContextRepository securityContextRepository;

    public AuthController(PasswordEncoder passwordEncoder,
                          UserAccountRepository userRepository,
                          AdminLogService adminLogService,
                          LoginAttemptService loginAttemptService,
                          SecurityContextRepository securityContextRepository) {
        this.passwordEncoder = passwordEncoder;
        this.userRepository = userRepository;
        this.adminLogService = adminLogService;
        this.loginAttemptService = loginAttemptService;
        this.securityContextRepository = securityContextRepository;
    }

    /**
     * 인증 이벤트 기록.
     * 로그인·회원가입은 SecurityContext가 아직 비어 있어 AOP(@AdminLoggable)로는
     * 사용자를 특정할 수 없으므로 요청에 담긴 아이디로 직접 기록한다.
     * 로그 기록 실패가 인증 요청 자체를 실패시키지 않도록 예외는 삼킨다.
     */
    private void logAuthEvent(String username, AdminLog.Action action, AdminLog.EntityType entityType,
                              Long entityId, String details) {
        try {
            adminLogService.logSystemAction(username, action, entityType, entityId, details);
        } catch (Exception e) {
            logger.warn("Failed to record auth log: {}", details, e);
        }
    }

    /**
     * 로그인 실패를 기록한다.
     *
     * 감사 로그는 잠금이 걸리는 순간에만 남긴다. 실패마다 INSERT를 하면 인증 없이
     * 호출 가능한 엔드포인트로 로그 테이블을 무한히 부풀릴 수 있다. 잠긴 뒤의
     * 시도는 어차피 isLocked에서 먼저 끊긴다.
     */
    private void recordLoginFailure(String username, Long userId, String reason) {
        if (loginAttemptService.recordFailure(username)) {
            logAuthEvent(username, AdminLog.Action.CREATE, AdminLog.EntityType.AUTH, userId,
                    "로그인 실패 누적으로 계정 잠금 | " + reason);
        }
    }

    public record RegisterRequest(
            @NotBlank(message = "아이디를 입력해 주세요") String username,
            @Email(message = "이메일 형식이 올바르지 않습니다.") String email,
            @NotBlank(message = "비밀번호를 입력해 주세요") String password,
            @NotBlank(message = "이름 또는 닉네임을 입력해 주세요") String displayName
    ) {}
    public record LoginRequest(
            @NotBlank(message = "아이디를 입력해 주세요") String username,
            @NotBlank(message = "비밀번호를 입력해 주세요") String password
    ) {}
    public record ChangePasswordRequest(@NotBlank String currentPassword, @NotBlank String newPassword) {}
    public record CsrfResponse(String headerName, String token) {}

    /** SPA가 로그인·쓰기 요청에 사용할 CSRF 토큰을 받는다. */
    @GetMapping("/csrf")
    public ResponseEntity<CsrfResponse> csrf(CsrfToken csrfToken) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(new CsrfResponse(csrfToken.getHeaderName(), csrfToken.getToken()));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest req) {
        if (req.password() == null || req.password().length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("error", "비밀번호는 8자 이상이어야 합니다."));
        }
        if (userRepository.existsByUsername(req.username())) {
            return ResponseEntity.badRequest().body(Map.of("error", "아이디가 이미 사용 중입니다."));
        }
        if (userRepository.existsByEmail(req.email())) {
            return ResponseEntity.badRequest().body(Map.of("error", "이메일이 이미 사용 중입니다."));
        }
        if (userRepository.existsByDisplayName(req.displayName())) {
            return ResponseEntity.badRequest().body(Map.of("error", "닉네임이 이미 사용 중입니다."));
        }

        UserAccount user = new UserAccount();
        user.setUsername(req.username());
        user.setEmail(req.email());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setDisplayName(req.displayName());
        user.setRoles(Set.of(UserRole.USER));
        // 가입 신청일 뿐이다. 관리자가 승인해야 로그인할 수 있으므로 세션을 만들지 않는다.
        user.setStatus(UserStatus.PENDING);
        userRepository.save(user);
        logAuthEvent(user.getUsername(), AdminLog.Action.CREATE, AdminLog.EntityType.USER, user.getId(),
                "회원가입 신청 | displayName=" + user.getDisplayName() + " | status=PENDING");

        return ResponseEntity.accepted().body(Map.of(
                "pending", true,
                "message", "가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다."));
    }

    /** 아이디가 없든 비밀번호가 틀렸든 같은 응답을 준다. 계정 존재 여부가 새지 않게. */
    private ResponseEntity<?> invalidCredentials() {
        return ResponseEntity.status(401).body(Map.of("error", "아이디 또는 비밀번호가 올바르지 않습니다."));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req,
                                   HttpServletRequest request,
                                   HttpServletResponse response) {
        return loginAttemptService.withLoginLock(req.username(),
                () -> loginWithAttemptLock(req, request, response));
    }

    private ResponseEntity<?> loginWithAttemptLock(LoginRequest req,
                                                   HttpServletRequest request,
                                                   HttpServletResponse response) {
        // 비밀번호 대조 이전에 끊는다. 잠긴 계정에는 bcrypt 비교도 하지 않는다.
        if (loginAttemptService.isLocked(req.username())) {
            long minutes = loginAttemptService.lockoutMinutesRemaining(req.username());
            return ResponseEntity.status(429).body(Map.of(
                    "error", "로그인 시도가 너무 많습니다. " + minutes + "분 후에 다시 시도해 주세요."));
        }

        var userOpt = userRepository.findByUsername(req.username());
        if (userOpt.isEmpty()) {
            recordLoginFailure(req.username(), null, "존재하지 않는 아이디");
            return invalidCredentials();
        }
        var user = userOpt.get();
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            recordLoginFailure(user.getUsername(), user.getId(), "비밀번호 불일치");
            return invalidCredentials();
        }
        // 비밀번호 확인 뒤에 승인 여부를 본다. 승인 전에 걸러 버리면 아이디 존재 여부가
        // 비밀번호 없이도 드러난다. code=FORBIDDEN은 클라이언트가 권한 거부와 세션 만료를
        // 구분하는 응답 규약이다.
        if (!user.canAccess()) {
            String reason = switch (user.getStatus() == null ? UserStatus.PENDING : user.getStatus()) {
                case REJECTED -> "가입이 거절된 계정입니다. 관리자에게 문의해 주세요.";
                case WITHDRAWN -> "탈퇴 처리된 계정입니다. 관리자에게 문의해 주세요.";
                default -> "관리자 승인 대기 중입니다. 승인 후 로그인할 수 있습니다.";
            };
            logAuthEvent(user.getUsername(), AdminLog.Action.CREATE, AdminLog.EntityType.AUTH, user.getId(),
                    "로그인 실패 | 접근 불가 계정 status=" + user.getStatus());
            return ResponseEntity.status(403).body(Map.of("code", "FORBIDDEN", "error", reason));
        }
        loginAttemptService.recordSuccess(user.getUsername());
        logAuthEvent(user.getUsername(), AdminLog.Action.CREATE, AdminLog.EntityType.AUTH, user.getId(), "로그인 성공");
        // CSRF 조회가 먼저 만든 세션이 있으면 로그인 시 세션 ID를 교체해
        // 세션 고정 공격을 막는다.
        if (request.getSession(false) != null) {
            request.changeSessionId();
        }
        var principal = new SessionPrincipal(user.getUsername(), user.getAuthVersion());
        var authorities = user.getRoles().stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role.name()))
                .collect(Collectors.toList());
        var authentication = new UsernamePasswordAuthenticationToken(principal, null, authorities);
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, request, response);

        String avatarUrl = UserAvatarService.avatarUrl(user.getAvatarKey());
        return ResponseEntity.ok(Map.of(
                "username", user.getUsername(),
                "displayName", user.getDisplayName() == null ? "" : user.getDisplayName(),
                "avatarUrl", avatarUrl == null ? "" : avatarUrl,
                "roles", user.getRoles()));
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@Valid @RequestBody ChangePasswordRequest req,
                                            HttpServletRequest request,
                                            HttpServletResponse response) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) return ResponseEntity.status(401).body(Map.of("error", "unauthorized"));
        var user = userRepository.findByUsername(auth.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(401).body(Map.of("error", "unauthorized"));
        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
            logAuthEvent(user.getUsername(), AdminLog.Action.UPDATE, AdminLog.EntityType.AUTH, user.getId(),
                    "비밀번호 변경 실패 | 현재 비밀번호 불일치");
            return ResponseEntity.status(400).body(Map.of("error", "현재 비밀번호가 올바르지 않습니다."));
        }
        if (req.newPassword().length() < 8) {
            return ResponseEntity.status(400).body(Map.of("error", "새 비밀번호는 8자 이상이어야 합니다."));
        }
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        // 다른 기기의 세션도 authVersion 변경으로 다음 요청에서 무효화된다.
        user.bumpAuthVersion();
        userRepository.save(user);
        new SecurityContextLogoutHandler().logout(request, response, auth);
        logAuthEvent(user.getUsername(), AdminLog.Action.UPDATE, AdminLog.EntityType.AUTH, user.getId(), "비밀번호 변경");
        return ResponseEntity.ok(Map.of("changed", true));
    }

}


