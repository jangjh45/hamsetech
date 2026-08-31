package com.hamsetech.hamsetech.security;

import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import com.hamsetech.hamsetech.user.UserRole;
import com.hamsetech.hamsetech.user.UserStatus;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 인증 필터가 토큰을 통과시키는 조건.
 *
 * 여기서 막히지 않으면 뒤의 어떤 권한 검사도 의미가 없으므로, 거부해야 할 경우를
 * 하나씩 고정한다.
 */
class JwtAuthenticationFilterTest {

    private static final String SECRET = "test-only-secret-that-is-long-enough-for-hmac-sha";

    private JwtService jwtService;
    private UserAccountRepository userRepository;
    private JwtAuthenticationFilter filter;
    private FilterChain chain;

    @BeforeEach
    void setUp() {
        JwtProperties properties = new JwtProperties();
        properties.setSecret(SECRET);
        jwtService = new JwtService(properties);
        userRepository = mock(UserAccountRepository.class);
        filter = new JwtAuthenticationFilter(jwtService, userRepository);
        chain = mock(FilterChain.class);
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private UserAccount user(UserStatus status, int tokenVersion) {
        UserAccount user = new UserAccount();
        user.setUsername("kim");
        user.setStatus(status);
        user.setRoles(Set.of(UserRole.USER, UserRole.ADMIN));
        for (int i = 0; i < tokenVersion; i++) {
            user.bumpTokenVersion();
        }
        return user;
    }

    /** 요청을 필터에 통과시키고, 인증이 설정됐는지 돌려준다. 체인은 항상 이어져야 한다. */
    private boolean authenticates(String authorizationHeader) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        if (authorizationHeader != null) {
            request.addHeader("Authorization", authorizationHeader);
        }
        filter.doFilter(request, new MockHttpServletResponse(), chain);

        // 인증에 실패하더라도 요청은 계속 흘러가야 한다. 거부는 시큐리티 체인의 몫이다.
        verify(chain).doFilter(any(), any());
        return SecurityContextHolder.getContext().getAuthentication() != null;
    }

    @Test
    @DisplayName("정상 토큰이면 권한과 함께 인증된다")
    void authenticatesValidToken() throws Exception {
        UserAccount user = user(UserStatus.APPROVED, 0);
        when(userRepository.findByUsername("kim")).thenReturn(Optional.of(user));

        assertThat(authenticates("Bearer " + jwtService.generateToken(user))).isTrue();

        var auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth.getName()).isEqualTo("kim");
        assertThat(auth.getAuthorities()).extracting("authority")
                .containsExactlyInAnyOrder("ROLE_USER", "ROLE_ADMIN");
    }

    @Test
    @DisplayName("Authorization 헤더가 없으면 인증하지 않는다")
    void ignoresMissingHeader() throws Exception {
        assertThat(authenticates(null)).isFalse();
    }

    @Test
    @DisplayName("Bearer가 아닌 헤더는 무시한다")
    void ignoresNonBearerHeader() throws Exception {
        assertThat(authenticates("Basic a2ltOnNlY3JldA==")).isFalse();
    }

    @Test
    @DisplayName("페이로드가 변조된 토큰은 통과하지 못한다")
    void rejectsTamperedToken() throws Exception {
        UserAccount user = user(UserStatus.APPROVED, 0);
        when(userRepository.findByUsername("kim")).thenReturn(Optional.of(user));

        // 서명은 그대로 두고 페이로드만 바꾼다. 토큰 끝에 문자를 덧붙이는 방식은
        // base64url이 남는 비트를 흘려버려 같은 서명으로 디코딩될 수 있어 변조가 되지 않는다.
        String[] parts = jwtService.generateToken(user).split("[.]");
        parts[1] = flipFirstChar(parts[1]);
        String tampered = String.join(".", parts);

        assertThat(authenticates("Bearer " + tampered)).isFalse();
    }

    /** base64url 문자 하나를 확실히 다른 문자로 바꾼다. */
    private String flipFirstChar(String segment) {
        char original = segment.charAt(0);
        char replacement = original == 'A' ? 'B' : 'A';
        return replacement + segment.substring(1);
    }

    @Test
    @DisplayName("토큰은 유효해도 계정이 없으면 통과하지 못한다")
    void rejectsWhenAccountIsGone() throws Exception {
        UserAccount user = user(UserStatus.APPROVED, 0);
        String token = jwtService.generateToken(user);
        when(userRepository.findByUsername("kim")).thenReturn(Optional.empty());

        assertThat(authenticates("Bearer " + token)).isFalse();
    }

    @Test
    @DisplayName("승인 대기 계정은 토큰이 유효해도 통과하지 못한다")
    void rejectsPendingAccount() throws Exception {
        UserAccount user = user(UserStatus.PENDING, 0);
        String token = jwtService.generateToken(user);
        when(userRepository.findByUsername("kim")).thenReturn(Optional.of(user));

        assertThat(authenticates("Bearer " + token)).isFalse();
    }

    @Test
    @DisplayName("탈퇴 처리된 계정은 남아 있는 토큰으로도 통과하지 못한다")
    void rejectsWithdrawnAccount() throws Exception {
        UserAccount user = user(UserStatus.APPROVED, 0);
        String token = jwtService.generateToken(user);
        // 토큰 발급 이후 탈퇴가 확정된 상황
        user.setStatus(UserStatus.WITHDRAWN);
        when(userRepository.findByUsername("kim")).thenReturn(Optional.of(user));

        assertThat(authenticates("Bearer " + token)).isFalse();
    }

    @Test
    @DisplayName("탈퇴 신청 중인 계정은 통과한다 — 본인이 신청을 취소할 수 있어야 한다")
    void allowsWithdrawRequestedAccount() throws Exception {
        UserAccount user = user(UserStatus.WITHDRAW_REQUESTED, 0);
        when(userRepository.findByUsername("kim")).thenReturn(Optional.of(user));

        assertThat(authenticates("Bearer " + jwtService.generateToken(user))).isTrue();
    }

    @Test
    @DisplayName("비밀번호 변경 이전에 발급된 토큰은 통과하지 못한다")
    void rejectsTokenIssuedBeforePasswordChange() throws Exception {
        UserAccount user = user(UserStatus.APPROVED, 0);
        String oldToken = jwtService.generateToken(user);

        // 비밀번호 변경·초기화·탈퇴 확정이 하는 일
        user.bumpTokenVersion();
        when(userRepository.findByUsername("kim")).thenReturn(Optional.of(user));

        assertThat(authenticates("Bearer " + oldToken)).isFalse();
    }

    @Test
    @DisplayName("세대를 올린 뒤 새로 발급한 토큰은 통과한다")
    void acceptsTokenIssuedAfterBump() throws Exception {
        UserAccount user = user(UserStatus.APPROVED, 0);
        user.bumpTokenVersion();
        when(userRepository.findByUsername("kim")).thenReturn(Optional.of(user));

        assertThat(authenticates("Bearer " + jwtService.generateToken(user))).isTrue();
    }
}
