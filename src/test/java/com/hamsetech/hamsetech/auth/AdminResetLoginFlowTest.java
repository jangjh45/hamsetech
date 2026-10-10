package com.hamsetech.hamsetech.auth;

import com.hamsetech.hamsetech.admin.AdminLogService;
import com.hamsetech.hamsetech.admin.AdminPasswordResetService;
import com.hamsetech.hamsetech.security.JwtService;
import com.hamsetech.hamsetech.security.LoginAttemptService;
import com.hamsetech.hamsetech.security.LoginProperties;
import com.hamsetech.hamsetech.security.SecurityUtils;
import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import com.hamsetech.hamsetech.user.UserRole;
import com.hamsetech.hamsetech.user.UserStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Clock;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminResetLoginFlowTest {

    @Test
    @DisplayName("잠긴 계정도 관리자가 초기화한 임시 비밀번호로 바로 로그인할 수 있다")
    void canLogInWithTemporaryPasswordImmediatelyAfterReset() {
        UserAccountRepository userRepository = mock(UserAccountRepository.class);
        AdminLogService adminLogService = mock(AdminLogService.class);
        JwtService jwtService = mock(JwtService.class);
        SecurityUtils securityUtils = mock(SecurityUtils.class);
        PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
        LoginProperties properties = new LoginProperties();
        LoginAttemptService loginAttemptService = new LoginAttemptService(properties, Clock.systemUTC());

        UserAccount user = new UserAccount();
        user.setUsername("kim");
        user.setDisplayName("김한세");
        user.setPasswordHash(passwordEncoder.encode("old-password"));
        user.setRoles(Set.of(UserRole.USER));
        user.setStatus(UserStatus.APPROVED);
        when(userRepository.findByUsername("kim")).thenReturn(Optional.of(user));
        when(userRepository.save(any(UserAccount.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(securityUtils.isSuperAdmin()).thenReturn(false);
        when(jwtService.generateToken(any(UserAccount.class))).thenReturn("test.jwt.token");

        for (int i = 0; i < properties.getMaxAttempts(); i++) {
            loginAttemptService.recordFailure("kim");
        }
        assertThat(loginAttemptService.isLocked("kim")).isTrue();

        AuthController authController = new AuthController(
                passwordEncoder, userRepository, jwtService, adminLogService, loginAttemptService);
        ResponseEntity<?> lockedResponse = authController.login(
                new AuthController.LoginRequest("kim", "old-password"));
        assertThat(lockedResponse.getStatusCode().value()).isEqualTo(429);

        AdminPasswordResetService resetService = new AdminPasswordResetService(
                userRepository, passwordEncoder, securityUtils, loginAttemptService);
        String temporaryPassword = resetService.resetPassword(user);

        ResponseEntity<?> loginResponse = authController.login(
                new AuthController.LoginRequest("kim", temporaryPassword));
        assertThat(loginResponse.getStatusCode().value()).isEqualTo(200);
        assertThat(((Map<?, ?>) loginResponse.getBody()).get("token")).isEqualTo("test.jwt.token");
        assertThat(loginAttemptService.isLocked("kim")).isFalse();
    }
}
