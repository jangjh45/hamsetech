package com.hamsetech.hamsetech.auth;

import com.hamsetech.hamsetech.admin.AdminLog;
import com.hamsetech.hamsetech.admin.AdminLogService;
import com.hamsetech.hamsetech.security.JwtService;
import com.hamsetech.hamsetech.security.LoginAttemptService;
import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import com.hamsetech.hamsetech.user.UserRole;
import com.hamsetech.hamsetech.user.UserStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    private final PasswordEncoder passwordEncoder;
    private final UserAccountRepository userRepository;
    private final JwtService jwtService;
    private final AdminLogService adminLogService;
    private final LoginAttemptService loginAttemptService;

    public AuthController(PasswordEncoder passwordEncoder,
                          UserAccountRepository userRepository,
                          JwtService jwtService,
                          AdminLogService adminLogService,
                          LoginAttemptService loginAttemptService) {
        this.passwordEncoder = passwordEncoder;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.adminLogService = adminLogService;
        this.loginAttemptService = loginAttemptService;
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
        // 가입 신청일 뿐이다. 관리자가 승인해야 로그인할 수 있으므로 토큰을 주지 않는다.
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
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req) {
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
        // 비밀번호 없이도 드러난다.
        // code: FORBIDDEN은 클라이언트가 이 403을 "토큰 만료"로 오인하지 않게 하는 규약이다.
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
        String token = jwtService.generateToken(user);
        return ResponseEntity.ok(Map.of("token", token, "username", user.getUsername(), "displayName", user.getDisplayName(), "roles", user.getRoles()));
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@Valid @RequestBody ChangePasswordRequest req) {
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
        // 비밀번호를 바꾼 이유가 유출 의심이라면, 옛 비밀번호로 발급된 토큰이
        // 만료(기본 24시간)까지 살아 있는 것 자체가 문제다. 전부 무효화한다.
        user.bumpTokenVersion();
        userRepository.save(user);
        logAuthEvent(user.getUsername(), AdminLog.Action.UPDATE, AdminLog.EntityType.AUTH, user.getId(), "비밀번호 변경");
        return ResponseEntity.ok(Map.of("changed", true));
    }

}


