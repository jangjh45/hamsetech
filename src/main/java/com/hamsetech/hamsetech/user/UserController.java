package com.hamsetech.hamsetech.user;

import com.hamsetech.hamsetech.admin.AdminLog;
import com.hamsetech.hamsetech.admin.AdminLoggable;
import com.hamsetech.hamsetech.security.SecurityUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@PreAuthorize("isAuthenticated()")
public class UserController {

    private final UserAccountRepository userRepo;
    private final PasswordEncoder passwordEncoder;
    private final UserWithdrawalService withdrawalService;
    private final SecurityUtils securityUtils;
    private final UserAvatarService avatarService;

    public UserController(UserAccountRepository userRepo,
                          PasswordEncoder passwordEncoder,
                          UserWithdrawalService withdrawalService,
                          SecurityUtils securityUtils,
                          UserAvatarService avatarService) {
        this.userRepo = userRepo;
        this.passwordEncoder = passwordEncoder;
        this.withdrawalService = withdrawalService;
        this.securityUtils = securityUtils;
        this.avatarService = avatarService;
    }

    public record UpdateProfileRequest(String displayName) {}
    public record ChangeEmailRequest(
            @NotBlank(message = "이메일을 입력해 주세요") @Email(message = "이메일 형식이 올바르지 않습니다") String email,
            @NotBlank(message = "현재 비밀번호를 입력해 주세요") String currentPassword) {}

    public record WithdrawRequest(String password, String reason) {}

    /** Map.of는 null 값을 허용하지 않는다. 탈퇴 관련 필드는 대부분 null이라 HashMap을 쓴다. */
    private static Map<String, Object> toProfileResponse(UserAccount user) {
        Map<String, Object> body = new HashMap<>();
        body.put("username", user.getUsername());
        body.put("email", user.getEmail());
        body.put("displayName", user.getDisplayName() != null ? user.getDisplayName() : "");
        body.put("avatarUrl", UserAvatarService.avatarUrl(user.getAvatarKey()));
        body.put("roles", user.getRoles());
        body.put("status", user.getStatus() == null ? null : user.getStatus().name());
        Instant requestedAt = user.getWithdrawRequestedAt();
        body.put("withdrawRequestedAt", requestedAt == null ? null : requestedAt.toString());
        body.put("withdrawReason", user.getWithdrawReason());
        return body;
    }

    @GetMapping("/me")
    public ResponseEntity<?> getMyProfile() {
        UserAccount user = securityUtils.currentUser();
        return ResponseEntity.ok(toProfileResponse(user));
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.USER,
            details = "내 프로필 수정", adminOnly = false)
    @PutMapping("/me")
    public ResponseEntity<?> updateMyProfile(@RequestBody UpdateProfileRequest req) {
        UserAccount user = securityUtils.currentUser();

        if (req.displayName() != null) {
            // Check if display name is taken by another user
            if (userRepo.existsByDisplayName(req.displayName()) &&
                !req.displayName().equals(user.getDisplayName())) {
                return ResponseEntity.badRequest().body(Map.of("error", "이미 사용 중인 닉네임입니다."));
            }
            user.setDisplayName(req.displayName());
        }

        @SuppressWarnings("null")
        UserAccount savedUser = userRepo.save(user);
        return ResponseEntity.ok(toProfileResponse(savedUser));
    }

    /** 이메일은 메일 인증 없이 변경하므로 현재 비밀번호를 다시 확인한다. */
    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.USER,
            details = "내 이메일 변경", adminOnly = false)
    @PutMapping("/me/email")
    public ResponseEntity<?> changeMyEmail(@Valid @RequestBody ChangeEmailRequest req) {
        UserAccount user = securityUtils.currentUser();
        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
            return ResponseEntity.badRequest().body(Map.of("error", "현재 비밀번호가 올바르지 않습니다."));
        }

        String email = req.email().trim();
        if (email.equalsIgnoreCase(user.getEmail())) {
            return ResponseEntity.badRequest().body(Map.of("error", "새 이메일이 현재 이메일과 같습니다."));
        }
        if (userRepo.existsByEmailIgnoreCase(email)) {
            return ResponseEntity.badRequest().body(Map.of("error", "이미 사용 중인 이메일입니다."));
        }

        user.setEmail(email);
        return ResponseEntity.ok(toProfileResponse(userRepo.save(user)));
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.USER,
            details = "내 프로필 사진 변경", adminOnly = false)
    @PostMapping(value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadMyAvatar(@RequestParam("file") MultipartFile file) {
        UserAccount savedUser = avatarService.replace(securityUtils.currentUser(), file);
        return ResponseEntity.ok(toProfileResponse(savedUser));
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.USER,
            details = "내 프로필 사진 삭제", adminOnly = false)
    @DeleteMapping("/me/avatar")
    public ResponseEntity<?> deleteMyAvatar() {
        UserAccount savedUser = avatarService.clear(securityUtils.currentUser());
        return ResponseEntity.ok(toProfileResponse(savedUser));
    }

    /** 아바타는 댓글 작성자 정보로 의도적으로 노출되는 이미지이며 URL 키는 UUID다. */
    @GetMapping(value = "/avatars/{avatarKey}")
    @PreAuthorize("permitAll()")
    public ResponseEntity<Resource> getAvatar(@PathVariable String avatarKey) {
        UserAvatarService.AvatarFile avatar = avatarService.findByKey(avatarKey).orElse(null);
        if (avatar == null) return ResponseEntity.notFound().build();

        Resource resource = avatar.resource();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(avatar.contentType()))
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=600, immutable")
                .body(resource);
    }

    /**
     * 회원 탈퇴 신청.
     * 가입이 승인제인 것과 대칭으로 탈퇴도 관리자가 확정한다. 여기서는 신청만 남기고
     * 토큰은 그대로 둔다. 확정 전까지 본인이 취소할 수 있어야 하기 때문이다.
     */
    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.USER,
            details = "회원 탈퇴 신청", adminOnly = false)
    @PostMapping("/me/withdraw")
    public ResponseEntity<?> requestWithdraw(@RequestBody WithdrawRequest req) {
        UserAccount user = securityUtils.currentUser();

        if (user.isSuperAdmin()) {
            return ResponseEntity.badRequest().body(Map.of("error", "SUPER_ADMIN 계정은 탈퇴할 수 없습니다."));
        }
        if (user.isWithdrawRequested()) {
            return ResponseEntity.badRequest().body(Map.of("error", "이미 탈퇴를 신청했습니다."));
        }
        // 로그인한 화면을 그대로 두고 자리를 비운 사이 눌리는 것을 막는다
        if (req == null || req.password() == null || !passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            return ResponseEntity.badRequest().body(Map.of("error", "비밀번호가 올바르지 않습니다."));
        }

        user.setStatus(UserStatus.WITHDRAW_REQUESTED);
        user.setWithdrawRequestedAt(Instant.now());
        user.setWithdrawReason(req.reason() == null || req.reason().isBlank() ? null : req.reason().trim());
        userRepo.save(user);

        return ResponseEntity.ok(Map.of(
                "requested", true,
                "message", "탈퇴 신청이 접수되었습니다. 관리자 확정 후 계정이 정리됩니다."));
    }

    @AdminLoggable(action = AdminLog.Action.UPDATE, entityType = AdminLog.EntityType.USER,
            details = "회원 탈퇴 신청 취소", adminOnly = false)
    @DeleteMapping("/me/withdraw")
    public ResponseEntity<?> cancelWithdraw() {
        UserAccount user = securityUtils.currentUser();
        try {
            withdrawalService.cancelWithdrawRequest(user);
        } catch (UserWithdrawalService.WithdrawalNotAllowedException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
        return ResponseEntity.ok(Map.of("canceled", true));
    }
}
