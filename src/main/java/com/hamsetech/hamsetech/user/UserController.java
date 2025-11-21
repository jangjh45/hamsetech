package com.hamsetech.hamsetech.user;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
@PreAuthorize("isAuthenticated()")
public class UserController {

    private final UserAccountRepository userRepo;

    public UserController(UserAccountRepository userRepo) {
        this.userRepo = userRepo;
    }

    private UserAccount getCurrentUser(Authentication authentication) {
        return userRepo.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public record UpdateProfileRequest(String displayName) {}

    @GetMapping("/me")
    public ResponseEntity<?> getMyProfile(Authentication authentication) {
        UserAccount user = getCurrentUser(authentication);
        return ResponseEntity.ok(Map.of(
            "username", user.getUsername(),
            "email", user.getEmail(),
            "displayName", user.getDisplayName() != null ? user.getDisplayName() : "",
            "roles", user.getRoles()
        ));
    }

    @PutMapping("/me")
    public ResponseEntity<?> updateMyProfile(@RequestBody UpdateProfileRequest req, Authentication authentication) {
        UserAccount user = getCurrentUser(authentication);
        
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
        return ResponseEntity.ok(Map.of(
            "username", savedUser.getUsername(),
            "email", savedUser.getEmail(),
            "displayName", savedUser.getDisplayName(),
            "roles", savedUser.getRoles()
        ));
    }
}
