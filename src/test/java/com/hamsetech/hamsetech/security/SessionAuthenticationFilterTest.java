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
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SessionAuthenticationFilterTest {

    private UserAccountRepository userRepository;
    private SessionAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        userRepository = mock(UserAccountRepository.class);
        filter = new SessionAuthenticationFilter(userRepository);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("현재 DB 권한을 매 요청에 반영한다")
    void refreshesAuthoritiesFromCurrentAccount() throws Exception {
        UserAccount user = user(UserStatus.APPROVED, UserRole.USER, UserRole.ADMIN);
        when(userRepository.findByUsername("kim")).thenReturn(Optional.of(user));

        AtomicReference<Authentication> atController = runFilter(0);

        assertThat(atController.get().getName()).isEqualTo("kim");
        assertThat(atController.get().getAuthorities())
                .extracting("authority")
                .contains("ROLE_USER", "ROLE_ADMIN");
    }

    @Test
    @DisplayName("비밀번호 변경으로 인증 버전이 바뀌면 기존 세션을 무효화한다")
    void invalidatesSessionWhenAuthVersionChanges() throws Exception {
        UserAccount user = user(UserStatus.APPROVED, UserRole.USER);
        user.bumpAuthVersion();
        when(userRepository.findByUsername("kim")).thenReturn(Optional.of(user));

        MockHttpSession session = new MockHttpSession();
        AtomicReference<Authentication> atController = runFilter(0, session);

        assertThat(atController.get()).isNull();
        assertThat(session.isInvalid()).isTrue();
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    @DisplayName("승인이 취소된 계정의 세션을 무효화한다")
    void invalidatesSessionWhenAccountCannotAccess() throws Exception {
        UserAccount user = user(UserStatus.REJECTED, UserRole.USER);
        when(userRepository.findByUsername("kim")).thenReturn(Optional.of(user));

        MockHttpSession session = new MockHttpSession();
        AtomicReference<Authentication> atController = runFilter(0, session);

        assertThat(atController.get()).isNull();
        assertThat(session.isInvalid()).isTrue();
    }

    private AtomicReference<Authentication> runFilter(int principalVersion) throws Exception {
        return runFilter(principalVersion, new MockHttpSession());
    }

    private AtomicReference<Authentication> runFilter(int principalVersion, MockHttpSession session)
            throws Exception {
        var principal = new SessionPrincipal("kim", principalVersion);
        var original = new UsernamePasswordAuthenticationToken(
                principal, null, Set.of(new SimpleGrantedAuthority("ROLE_USER")));
        SecurityContextHolder.getContext().setAuthentication(original);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSession(session);
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<Authentication> atController = new AtomicReference<>();
        FilterChain chain = (servletRequest, servletResponse) ->
                atController.set(SecurityContextHolder.getContext().getAuthentication());

        filter.doFilter(request, response, chain);
        return atController;
    }

    private UserAccount user(UserStatus status, UserRole... roles) {
        UserAccount user = new UserAccount();
        user.setUsername("kim");
        user.setStatus(status);
        user.setRoles(Set.of(roles));
        return user;
    }
}
