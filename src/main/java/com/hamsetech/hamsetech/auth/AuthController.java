package com.hamsetech.hamsetech.auth;

import com.hamsetech.hamsetech.security.JwtService;
import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import com.hamsetech.hamsetech.user.UserRole;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final PasswordEncoder passwordEncoder;
    private final UserAccountRepository userRepository;
    private final JwtService jwtService;

    public AuthController(PasswordEncoder passwordEncoder,
                          UserAccountRepository userRepository,
                          JwtService jwtService) {
        this.passwordEncoder = passwordEncoder;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
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
        userRepository.save(user);

        String token = jwtService.generateToken(user);
        return ResponseEntity.ok(Map.of("token", token, "username", user.getUsername(), "displayName", user.getDisplayName(), "roles", user.getRoles()));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req) {
        var userOpt = userRepository.findByUsername(req.username());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("error", "아이디 또는 비밀번호가 올바르지 않습니다."));
        }
        var user = userOpt.get();
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            return ResponseEntity.status(401).body(Map.of("error", "아이디 또는 비밀번호가 올바르지 않습니다."));
        }
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
            return ResponseEntity.status(400).body(Map.of("error", "현재 비밀번호가 올바르지 않습니다."));
        }
        if (req.newPassword().length() < 8) {
            return ResponseEntity.status(400).body(Map.of("error", "새 비밀번호는 8자 이상이어야 합니다."));
        }
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("changed", true));
    }

    @PostMapping("/reset-by-identity")
    public ResponseEntity<?> resetByIdentity(@Valid @RequestBody IdentityResetRequest req) {
        var user = userRepository.findByUsername(req.username()).orElse(null);
        if (user == null || user.getEmail() == null || !user.getEmail().equalsIgnoreCase(req.email())) {
            return ResponseEntity.status(400).body(Map.of("error", "아이디와 이메일이 일치하지 않습니다."));
        }
        if (req.newPassword().length() < 8) {
            return ResponseEntity.status(400).body(Map.of("error", "새 비밀번호는 8자 이상이어야 합니다."));
        }
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("reset", true));
    }
}


