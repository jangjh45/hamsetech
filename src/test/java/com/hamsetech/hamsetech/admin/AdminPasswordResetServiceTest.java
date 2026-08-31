package com.hamsetech.hamsetech.admin;

import com.hamsetech.hamsetech.security.SecurityUtils;
import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import com.hamsetech.hamsetech.user.UserRole;
import com.hamsetech.hamsetech.user.UserStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 관리자 비밀번호 초기화.
 *
 * 가장 중요한 것은 첫 번째 테스트다 — 일반 ADMIN이 SUPER_ADMIN의 비밀번호를
 * 초기화할 수 있으면, 그 자체가 최고 권한을 가져가는 경로가 된다.
 */
class AdminPasswordResetServiceTest {

    private UserAccountRepository userRepository;
    private SecurityUtils securityUtils;
    private PasswordEncoder passwordEncoder;
    private AdminPasswordResetService service;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserAccountRepository.class);
        securityUtils = mock(SecurityUtils.class);
        passwordEncoder = new BCryptPasswordEncoder();
        service = new AdminPasswordResetService(userRepository, passwordEncoder, securityUtils);
        when(userRepository.save(org.mockito.ArgumentMatchers.any(UserAccount.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    private UserAccount account(UserStatus status, UserRole... roles) {
        UserAccount user = new UserAccount();
        user.setUsername("target");
        user.setStatus(status);
        user.setRoles(new java.util.HashSet<>(Set.of(roles)));
        user.setPasswordHash(passwordEncoder.encode("original-password"));
        return user;
    }

    @Test
    @DisplayName("일반 ADMIN은 SUPER_ADMIN의 비밀번호를 초기화할 수 없다")
    void adminCannotResetSuperAdmin() {
        when(securityUtils.isSuperAdmin()).thenReturn(false);
        UserAccount target = account(UserStatus.APPROVED, UserRole.SUPER_ADMIN);

        assertThatThrownBy(() -> service.resetPassword(target))
                .isInstanceOf(AdminPasswordResetService.ResetNotAllowedException.class)
                .hasMessageContaining("SUPER_ADMIN");
    }

    @Test
    @DisplayName("거부된 초기화는 비밀번호와 토큰 세대를 건드리지 않는다")
    void rejectedResetLeavesAccountUntouched() {
        when(securityUtils.isSuperAdmin()).thenReturn(false);
        UserAccount target = account(UserStatus.APPROVED, UserRole.SUPER_ADMIN);
        String originalHash = target.getPasswordHash();

        assertThatThrownBy(() -> service.resetPassword(target))
                .isInstanceOf(AdminPasswordResetService.ResetNotAllowedException.class);

        assertThat(target.getPasswordHash()).isEqualTo(originalHash);
        assertThat(target.getTokenVersion()).isZero();
    }

    @Test
    @DisplayName("SUPER_ADMIN은 SUPER_ADMIN의 비밀번호를 초기화할 수 있다")
    void superAdminCanResetSuperAdmin() {
        when(securityUtils.isSuperAdmin()).thenReturn(true);
        UserAccount target = account(UserStatus.APPROVED, UserRole.SUPER_ADMIN);

        assertThat(service.resetPassword(target)).isNotBlank();
    }

    @Test
    @DisplayName("일반 계정은 ADMIN이 초기화할 수 있다")
    void adminCanResetRegularUser() {
        when(securityUtils.isSuperAdmin()).thenReturn(false);
        UserAccount target = account(UserStatus.APPROVED, UserRole.USER);

        assertThat(service.resetPassword(target)).isNotBlank();
    }

    @Test
    @DisplayName("탈퇴 처리된 계정은 초기화할 수 없다")
    void cannotResetWithdrawnAccount() {
        when(securityUtils.isSuperAdmin()).thenReturn(true);
        UserAccount target = account(UserStatus.WITHDRAWN, UserRole.USER);

        assertThatThrownBy(() -> service.resetPassword(target))
                .isInstanceOf(AdminPasswordResetService.ResetNotAllowedException.class)
                .hasMessageContaining("탈퇴");
    }

    @Test
    @DisplayName("저장되는 것은 임시 비밀번호의 해시이지 평문이 아니다")
    void storesHashNotPlaintext() {
        when(securityUtils.isSuperAdmin()).thenReturn(false);
        UserAccount target = account(UserStatus.APPROVED, UserRole.USER);

        String temporary = service.resetPassword(target);

        assertThat(target.getPasswordHash()).isNotEqualTo(temporary);
        assertThat(passwordEncoder.matches(temporary, target.getPasswordHash())).isTrue();
        // 옛 비밀번호로는 더 이상 로그인되지 않아야 한다
        assertThat(passwordEncoder.matches("original-password", target.getPasswordHash())).isFalse();
    }

    @Test
    @DisplayName("초기화하면 대상 계정의 기존 토큰이 무효화된다")
    void bumpsTokenVersion() {
        when(securityUtils.isSuperAdmin()).thenReturn(false);
        UserAccount target = account(UserStatus.APPROVED, UserRole.USER);

        service.resetPassword(target);

        // 계정을 되찾으려고 초기화했는데 남이 쓰던 세션이 살아 있으면 의미가 없다
        assertThat(target.getTokenVersion()).isEqualTo(1);
    }

    @Test
    @DisplayName("임시 비밀번호는 매번 다르고, 혼동되는 글자를 쓰지 않는다")
    void generatesDistinctUnambiguousPasswords() {
        when(securityUtils.isSuperAdmin()).thenReturn(false);

        String first = service.resetPassword(account(UserStatus.APPROVED, UserRole.USER));
        String second = service.resetPassword(account(UserStatus.APPROVED, UserRole.USER));

        assertThat(first).isNotEqualTo(second);
        assertThat(first).hasSize(12);
        // 관리자가 구두로 옮겨 적는 값이라 0/O, 1/l/I는 빼 둔다
        assertThat(first).doesNotContainAnyWhitespaces().doesNotContain("0", "O", "1", "l", "I");
        assertThat(second).doesNotContain("0", "O", "1", "l", "I");
    }
}
