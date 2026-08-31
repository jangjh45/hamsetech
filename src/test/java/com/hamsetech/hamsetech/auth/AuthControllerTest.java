package com.hamsetech.hamsetech.auth;

import com.hamsetech.hamsetech.admin.AdminLogService;
import com.hamsetech.hamsetech.config.SecurityConfig;
import com.hamsetech.hamsetech.security.JwtAuthenticationFilter;
import com.hamsetech.hamsetech.security.JwtService;
import com.hamsetech.hamsetech.security.LoginAttemptService;
import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import com.hamsetech.hamsetech.user.UserRole;
import com.hamsetech.hamsetech.user.UserStatus;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;
import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 로그인 응답의 계약.
 *
 * 로그인은 인증 없이 누구나 두드릴 수 있는 문이다. 응답이 계정의 존재 여부를
 * 흘리지 않는지, 시도 제한이 실제로 걸리는지를 고정한다.
 */
@WebMvcTest(controllers = AuthController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
@ActiveProfiles("test")
class AuthControllerTest {

    private static final String LOGIN_BODY = "{\"username\":\"kim\",\"password\":\"secret12\"}";

    /** 아이디가 없든 비밀번호가 틀렸든 사용자가 보는 문구는 같아야 한다. */
    private static final String GENERIC_MESSAGE = "아이디 또는 비밀번호가 올바르지 않습니다.";

    @Autowired
    private MockMvc mvc;

    @MockitoBean private UserAccountRepository userRepository;
    @MockitoBean private PasswordEncoder passwordEncoder;
    @MockitoBean private JwtService jwtService;
    @MockitoBean private AdminLogService adminLogService;
    @MockitoBean private LoginAttemptService loginAttemptService;

    private UserAccount user(UserStatus status) {
        UserAccount user = new UserAccount();
        user.setUsername("kim");
        user.setDisplayName("김한세");
        user.setPasswordHash("bcrypt-hash-stub");
        user.setStatus(status);
        user.setRoles(Set.of(UserRole.USER));
        return user;
    }

    @Test
    @DisplayName("없는 아이디와 틀린 비밀번호는 같은 401 응답을 준다")
    void doesNotRevealWhetherAccountExists() throws Exception {
        // 없는 아이디
        when(userRepository.findByUsername("kim")).thenReturn(Optional.empty());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value(GENERIC_MESSAGE));

        // 있는 아이디 + 틀린 비밀번호
        when(userRepository.findByUsername("kim")).thenReturn(Optional.of(user(UserStatus.APPROVED)));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value(GENERIC_MESSAGE));
    }

    @Test
    @DisplayName("잠긴 계정은 429를 받고 비밀번호 대조까지 가지 않는다")
    void lockedAccountGets429() throws Exception {
        when(loginAttemptService.isLocked("kim")).thenReturn(true);
        when(loginAttemptService.lockoutMinutesRemaining("kim")).thenReturn(12L);

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error").value(Matchers.containsString("12분")));

        // 잠긴 계정에는 bcrypt 비교조차 하지 않는다 — 이것이 시도 제한의 요점이다
        verify(passwordEncoder, never()).matches(anyString(), anyString());
        verify(userRepository, never()).findByUsername(anyString());
    }

    @Test
    @DisplayName("실패는 시도 카운터에 기록된다")
    void failureIsCounted() throws Exception {
        when(userRepository.findByUsername("kim")).thenReturn(Optional.empty());

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
                .andExpect(status().isUnauthorized());

        verify(loginAttemptService).recordFailure("kim");
    }

    @Test
    @DisplayName("잠기지 않은 동안의 실패는 감사 로그를 남기지 않는다")
    void ordinaryFailureDoesNotWriteAuditLog() throws Exception {
        // 실패마다 INSERT를 하면 인증 없이 로그 테이블을 부풀릴 수 있다.
        // 기록은 잠금이 걸리는 순간(recordFailure가 true)에만 남는다.
        when(userRepository.findByUsername("kim")).thenReturn(Optional.empty());
        when(loginAttemptService.recordFailure("kim")).thenReturn(false);

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
                .andExpect(status().isUnauthorized());

        verify(adminLogService, never()).logSystemAction(anyString(), any(), any(), any(), anyString());
    }

    @Test
    @DisplayName("잠금이 걸리는 순간에는 감사 로그를 한 번 남긴다")
    void lockoutIsAudited() throws Exception {
        when(userRepository.findByUsername("kim")).thenReturn(Optional.empty());
        when(loginAttemptService.recordFailure("kim")).thenReturn(true);

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
                .andExpect(status().isUnauthorized());

        verify(adminLogService).logSystemAction(anyString(), any(), any(), any(), anyString());
    }

    @Test
    @DisplayName("승인 대기 계정은 code=FORBIDDEN이 실린 403을 받는다")
    void pendingAccountGetsForbiddenWithCode() throws Exception {
        when(userRepository.findByUsername("kim")).thenReturn(Optional.of(user(UserStatus.PENDING)));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);

        // code를 빼먹으면 client.ts가 이 403을 토큰 만료로 오인한다
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.error").value(Matchers.containsString("승인")));
    }

    @Test
    @DisplayName("탈퇴 처리된 계정은 로그인할 수 없다")
    void withdrawnAccountCannotLogIn() throws Exception {
        when(userRepository.findByUsername("kim")).thenReturn(Optional.of(user(UserStatus.WITHDRAWN)));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    @DisplayName("로그인에 성공하면 토큰을 주고 시도 카운터를 지운다")
    void successIssuesTokenAndResetsCounter() throws Exception {
        when(userRepository.findByUsername("kim")).thenReturn(Optional.of(user(UserStatus.APPROVED)));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);
        when(jwtService.generateToken(any())).thenReturn("a.b.c");

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(LOGIN_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("a.b.c"))
                .andExpect(jsonPath("$.username").value("kim"));

        verify(loginAttemptService).recordSuccess("kim");
    }
}
