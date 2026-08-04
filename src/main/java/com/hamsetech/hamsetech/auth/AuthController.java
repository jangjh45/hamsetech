package com.hamsetech.hamsetech.auth;

import com.hamsetech.hamsetech.admin.AdminLog;
import com.hamsetech.hamsetech.admin.AdminLogService;
import com.hamsetech.hamsetech.security.JwtService;
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

    public AuthController(PasswordEncoder passwordEncoder,
                          UserAccountRepository userRepository,
                          JwtService jwtService,
                          AdminLogService adminLogService) {
        this.passwordEncoder = passwordEncoder;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.adminLogService = adminLogService;
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
    public record IdentityResetRequest(@NotBlank String username, @NotBlank String email, @NotBlank String newPassword) {}

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

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req) {
        var userOpt = userRepository.findByUsername(req.username());
        if (userOpt.isEmpty()) {
            logAuthEvent(req.username(), AdminLog.Action.CREATE, AdminLog.EntityType.AUTH, null,
                    "로그인 실패 | 존재하지 않는 아이디");
            return ResponseEntity.status(401).body(Map.of("error", "아이디 또는 비밀번호가 올바르지 않습니다."));
        }
        var user = userOpt.get();
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            logAuthEvent(user.getUsername(), AdminLog.Action.CREATE, AdminLog.EntityType.AUTH, user.getId(),
                    "로그인 실패 | 비밀번호 불일치");
            return ResponseEntity.status(401).body(Map.of("error", "아이디 또는 비밀번호가 올바르지 않습니다."));
        }
        // 비밀번호 확인 뒤에 승인 여부를 본다. 승인 전에 걸러 버리면 아이디 존재 여부가
        // 비밀번호 없이도 드러난다.
        // code: FORBIDDEN은 클라이언트가 이 403을 "토큰 만료"로 오인하지 않게 하는 규약이다.
        if (!user.isApproved()) {
            String reason = user.getStatus() == UserStatus.REJECTED
                    ? "가입이 거절된 계정입니다. 관리자에게 문의해 주세요."
                    : "관리자 승인 대기 중입니다. 승인 후 로그인할 수 있습니다.";
            logAuthEvent(user.getUsername(), AdminLog.Action.CREATE, AdminLog.EntityType.AUTH, user.getId(),
                    "로그인 실패 | 미승인 계정 status=" + user.getStatus());
            return ResponseEntity.status(403).body(Map.of("code", "FORBIDDEN", "error", reason));
        }
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
        userRepository.save(user);
        logAuthEvent(user.getUsername(), AdminLog.Action.UPDATE, AdminLog.EntityType.AUTH, user.getId(), "비밀번호 변경");
        return ResponseEntity.ok(Map.of("changed", true));
    }

    @PostMapping("/reset-by-identity")
    public ResponseEntity<?> resetByIdentity(@Valid @RequestBody IdentityResetRequest req) {
        var user = userRepository.findByUsername(req.username()).orElse(null);
        if (user == null || user.getEmail() == null || !user.getEmail().equalsIgnoreCase(req.email())) {
            logAuthEvent(req.username(), AdminLog.Action.UPDATE, AdminLog.EntityType.AUTH,
                    user == null ? null : user.getId(), "비밀번호 재설정 실패 | 아이디·이메일 불일치");
            return ResponseEntity.status(400).body(Map.of("error", "아이디와 이메일이 일치하지 않습니다."));
        }
        if (req.newPassword().length() < 8) {
            return ResponseEntity.status(400).body(Map.of("error", "새 비밀번호는 8자 이상이어야 합니다."));
        }
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);
        logAuthEvent(user.getUsername(), AdminLog.Action.UPDATE, AdminLog.EntityType.AUTH, user.getId(),
                "비밀번호 재설정 | 본인확인(아이디+이메일)");
        return ResponseEntity.ok(Map.of("reset", true));
    }
}


