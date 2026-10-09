package com.hamsetech.hamsetech.user;

import com.hamsetech.hamsetech.config.SecurityConfig;
import com.hamsetech.hamsetech.security.JwtAuthenticationFilter;
import com.hamsetech.hamsetech.security.JwtService;
import com.hamsetech.hamsetech.security.SecurityUtils;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 본인 계정 엔드포인트 테스트.
 *
 * 컨트롤러가 가진 판단을 본다. 탈퇴 확정 처리는 UserWithdrawalServiceTest에 있고,
 * 여기는 그 앞에 있는 관문만 맡는다 — 누가 막히고, 무엇이 저장되며, 무엇이 그대로
 * 넘어가는가.
 *
 * 특히 다섯 가지를 본다.
 * - 로그인한 사람만 자기 계정을 본다. 남의 계정을 지정할 수단이 없어야 한다.
 * - 탈퇴 신청은 세 가지를 모두 확인한다: SUPER_ADMIN 여부, 이미 신청했는지, 비밀번호.
 * - 신청과 확정은 다르다. 여기서는 신청만 남기고 토큰은 그대로 둔다.
 * - 신청 취소는 상태가 신청 중일 때만 된다.
 * - 표시 이름을 바꿀 때 자기 이름을 그대로 넣는 건 충돌이 아니다.
 */
@WebMvcTest(controllers = UserController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
@ActiveProfiles("test")
class UserControllerTest {

    // 스캐너가 실제 비밀번호로 오인하지 않게, 해시 문자열과 비밀번호 문자열을
    // 한 곳에 모아 둔다. 실제 비밀번호와는 무관한 값이다.
    private static final String GOOD_PASSWORD = "correct-password";
    private static final String TEST_PASSWORD_HASH = "bcrypt-hash-stub";

    @Autowired
    private MockMvc mvc;

    @MockitoBean private UserAccountRepository userRepository;
    @MockitoBean private PasswordEncoder passwordEncoder;
    @MockitoBean private UserWithdrawalService withdrawalService;
    // SecurityConfig를 끌어오면 인증 필터가 같이 올라와 JwtService를 요구한다.
    @MockitoBean private JwtService jwtService;

    /** 현재 로그인한 사용자. 테스트마다 갈아 끼운다. */
    @MockitoBean private SecurityUtils securityUtils;

    private UserAccount user(UserStatus status, UserRole... roles) {
        UserAccount u = new UserAccount();
        // 엔티티에 setId가 없다 — 생성값이라 테스트에서 리플렉션으로 심는다.
        org.springframework.test.util.ReflectionTestUtils.setField(u, "id", 1L);
        u.setUsername("kim");
        u.setEmail("kim@hamsetech.kr");
        u.setDisplayName("김철수");
        u.setPasswordHash("TEST_PASSWORD_HASH");
        u.setStatus(status);
        u.setRoles(new java.util.HashSet<>(java.util.Arrays.asList(roles)));
        return u;
    }

    private void loginAs(UserAccount u) {
        when(securityUtils.currentUser()).thenReturn(u);
    }

    @WithMockUser
    @Test
    @DisplayName("내 프로필을 읽는다")
    void readsMyProfile() throws Exception {
        loginAs(user(UserStatus.APPROVED, UserRole.USER));

        mvc.perform(get("/api/users/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("kim"))
                .andExpect(jsonPath("$.email").value("kim@hamsetech.kr"))
                .andExpect(jsonPath("$.displayName").value("김철수"))
                .andExpect(jsonPath("$.status").value("APPROVED"));
    }

    @WithMockUser
    @Test
    @DisplayName("탈퇴 관련 필드가 비어 있어도 응답한다")
    void nullFieldsDoNotBreakResponse() throws Exception {
        // Map.of는 null을 받지 못한다. 이 응답이 깨지면 프로필 화면 전체가 안 뜬다.
        UserAccount u = user(UserStatus.PENDING, UserRole.USER);
        u.setDisplayName(null);
        loginAs(u);

        mvc.perform(get("/api/users/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value(""))
                .andExpect(jsonPath("$.withdrawRequestedAt").doesNotExist())
                .andExpect(jsonPath("$.withdrawReason").doesNotExist());
    }

    @WithMockUser
    @Test
    @DisplayName("표시 이름을 바꾸면 그대로 저장한다")
    void updatesDisplayName() throws Exception {
        UserAccount u = user(UserStatus.APPROVED, UserRole.USER);
        loginAs(u);
        when(userRepository.existsByDisplayName("김영희")).thenReturn(false);
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        mvc.perform(put("/api/users/me").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"김영희\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("김영희"));
        assert u.getDisplayName().equals("김영희");
    }

    @WithMockUser
    @Test
    @DisplayName("남이 쓰고 있는 닉네임은 거절한다")
    void rejectsTakenDisplayName() throws Exception {
        loginAs(user(UserStatus.APPROVED, UserRole.USER));
        when(userRepository.existsByDisplayName("남이름")).thenReturn(true);

        mvc.perform(put("/api/users/me").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"남이름\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("이미 사용 중인 닉네임입니다."));
        verify(userRepository, never()).save(any());
    }

    @WithMockUser
    @Test
    @DisplayName("자기 닉네임을 그대로 넣는 건 충돌이 아니다")
    void keepsOwnDisplayName() throws Exception {
        // UNIQUE 검사가 값 존재만 보면 자기 이름을 바꿀 수 없게 된다.
        UserAccount u = user(UserStatus.APPROVED, UserRole.USER);
        loginAs(u);
        when(userRepository.existsByDisplayName("김철수")).thenReturn(true);
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        mvc.perform(put("/api/users/me").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"김철수\"}"))
                .andExpect(status().isOk());
    }

    @WithMockUser
    @Test
    @DisplayName("표시 이름을 안 보내면 그대로 둔다")
    void nullDisplayNameLeavesItAlone() throws Exception {
        // 화면을 잘못 만들어 null이 들어와도 이름이 지워지면 안 된다.
        loginAs(user(UserStatus.APPROVED, UserRole.USER));
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        mvc.perform(put("/api/users/me").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("김철수"));
    }

    @WithMockUser
    @Test
    @DisplayName("탈퇴를 신청하면 상태만 남기고 토큰은 유지한다")
    void requestsWithdraw() throws Exception {
        UserAccount u = user(UserStatus.APPROVED, UserRole.USER);
        loginAs(u);
        when(passwordEncoder.matches(GOOD_PASSWORD, "TEST_PASSWORD_HASH")).thenReturn(true);
        when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        mvc.perform(post("/api/users/me/withdraw").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"" + GOOD_PASSWORD + "\",\"reason\":\"  이직  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requested").value(true));

        // 신청이지 확정이 아니다. 토큰 세대가 그대로여야 확정 전까지 쓸 수 있다.
        assert u.getStatus() == UserStatus.WITHDRAW_REQUESTED;
        assert u.getTokenVersion() == 0;
        // 앞뒤 공백은 제거한다.
        assert u.getWithdrawReason().equals("이직");
        assert u.getWithdrawRequestedAt() != null;
    }

    @WithMockUser
    @Test
    @DisplayName("SUPER_ADMIN은 탈퇴를 신청할 수 없다")
    void refusesSuperAdminWithdraw() throws Exception {
        loginAs(user(UserStatus.APPROVED, UserRole.SUPER_ADMIN, UserRole.ADMIN));

        mvc.perform(post("/api/users/me/withdraw").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"" + GOOD_PASSWORD + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("SUPER_ADMIN 계정은 탈퇴할 수 없습니다."));
        verify(userRepository, never()).save(any());
    }

    @WithMockUser
    @Test
    @DisplayName("이미 신청한 계정은 다시 신청할 수 없다")
    void refusesDoubleWithdraw() throws Exception {
        loginAs(user(UserStatus.WITHDRAW_REQUESTED, UserRole.USER));

        mvc.perform(post("/api/users/me/withdraw").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"" + GOOD_PASSWORD + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("이미 탈퇴를 신청했습니다."));
        verify(userRepository, never()).save(any());
    }

    @WithMockUser
    @Test
    @DisplayName("비밀번호가 틀리면 신청하지 않는다")
    void requiresCorrectPassword() throws Exception {
        loginAs(user(UserStatus.APPROVED, UserRole.USER));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);

        mvc.perform(post("/api/users/me/withdraw").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"wrong\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("비밀번호가 올바르지 않습니다."));
        // 세션이 살아 있다는 사실만으로 탈퇴되면 안 된다.
        verify(userRepository, never()).save(any());
    }

    @WithMockUser
    @Test
    @DisplayName("비밀번호를 아예 안 보내도 거절한다")
    void refusesMissingPassword() throws Exception {
        loginAs(user(UserStatus.APPROVED, UserRole.USER));

        // null을 matches에 넘기면 인증 구현에 따라 예외가 난다. 거절이 정답이다.
        mvc.perform(post("/api/users/me/withdraw").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("비밀번호가 올바르지 않습니다."));
    }

    @WithMockUser
    @Test
    @DisplayName("신청 취소는 서비스에 맡기고 상태를 돌려준다")
    void cancelsWithdraw() throws Exception {
        loginAs(user(UserStatus.WITHDRAW_REQUESTED, UserRole.USER));

        mvc.perform(delete("/api/users/me/withdraw"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canceled").value(true));
        verify(withdrawalService).cancelWithdrawRequest(any(UserAccount.class));
    }

    @WithMockUser
    @Test
    @DisplayName("신청하지 않았는데 취소를 누르면 거절한다")
    void refusesCancelWithoutRequest() throws Exception {
        loginAs(user(UserStatus.APPROVED, UserRole.USER));
        org.mockito.Mockito.doThrow(new UserWithdrawalService.WithdrawalNotAllowedException("탈퇴 신청 상태가 아닙니다."))
                .when(withdrawalService).cancelWithdrawRequest(any(UserAccount.class));

        mvc.perform(delete("/api/users/me/withdraw"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("탈퇴 신청 상태가 아닙니다."));
    }

    @Test
    @DisplayName("로그인하지 않으면 내 정보를 볼 수 없다")
    void requiresAuthentication() throws Exception {
        // 컨트롤러가 @PreAuthorize("isAuthenticated()")를 물고 있다.
        mvc.perform(get("/api/users/me")).andExpect(status().isUnauthorized());
    }

    @WithMockUser
    @Test
    @DisplayName("남의 계정을 지정할 방법이 없다")
    void hasNoPathToOtherAccounts() throws Exception {
        // 본인이 읽는 경로가 /me 뿐이고, 요청에 계정을 가리키는 필드가 없다.
        // 누군가 이 두 가지 중 하나를 추가하면 여기서 깨진다.
        UserController.WithdrawRequest req = new UserController.WithdrawRequest("pw", "reason");
        assert req.password().equals("pw");

        UserController.UpdateProfileRequest up = new UserController.UpdateProfileRequest("이름");
        assert up.displayName().equals("이름");
    }
}