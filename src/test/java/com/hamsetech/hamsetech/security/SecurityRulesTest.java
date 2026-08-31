package com.hamsetech.hamsetech.security;

import com.hamsetech.hamsetech.admin.AdminLogRepository;
import com.hamsetech.hamsetech.admin.AdminLogService;
import com.hamsetech.hamsetech.admin.AdminPasswordResetService;
import com.hamsetech.hamsetech.admin.AdminReadLogRepository;
import com.hamsetech.hamsetech.api.AdminController;
import com.hamsetech.hamsetech.auth.AuthController;
import com.hamsetech.hamsetech.config.SecurityConfig;
import com.hamsetech.hamsetech.notice.NoticeController;
import com.hamsetech.hamsetech.notice.NoticeService;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import com.hamsetech.hamsetech.user.UserWithdrawalService;
import com.hamsetech.hamsetech.work.OvertimeRecordController;
import com.hamsetech.hamsetech.work.OvertimeRecordService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 인증·인가 규칙의 회귀 테스트.
 *
 * 이 파일이 존재하는 이유는 SecurityConfig의 주석에 적혀 있다 — @EnableMethodSecurity가
 * 빠져 있던 동안 컨트롤러의 @PreAuthorize가 전부 무효였고, 관리자 전용 엔드포인트를
 * 일반 사용자가 그대로 호출할 수 있었다. 그 사고를 다시 잡아낼 장치가 없었다.
 *
 * 진짜 SecurityConfig와 진짜 컨트롤러 매핑을 함께 올려, 필터 체인이 실제 경로에
 * 어떻게 걸리는지를 검증한다. 서비스·리포지토리는 목이라 DB가 필요 없다.
 */
@WebMvcTest(controllers = {NoticeController.class, AdminController.class, AuthController.class,
        OvertimeRecordController.class})
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
@ActiveProfiles("test")
class SecurityRulesTest {

    @Autowired
    private MockMvc mvc;

    // 인증 필터는 진짜를 쓴다. 목 필터는 doFilter가 아무 일도 하지 않아 체인이 끊긴다.
    // 이 테스트는 Authorization 헤더를 보내지 않으므로 필터는 그냥 통과시킨다.
    @MockitoBean private NoticeService noticeService;
    @MockitoBean private OvertimeRecordService overtimeRecordService;
    @MockitoBean private UserAccountRepository userAccountRepository;
    @MockitoBean private AdminLogRepository adminLogRepository;
    @MockitoBean private AdminReadLogRepository adminReadLogRepository;
    @MockitoBean private UserWithdrawalService userWithdrawalService;
    @MockitoBean private AdminPasswordResetService adminPasswordResetService;
    @MockitoBean private AdminLogService adminLogService;
    @MockitoBean private LoginAttemptService loginAttemptService;
    @MockitoBean private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    @MockitoBean private JwtService jwtService;

    // ── 인증되지 않은 요청 ────────────────────────────────────────────

    @Test
    @DisplayName("익명 요청은 403이 아니라 401을 받는다")
    void anonymousRequestGets401() throws Exception {
        // 기본 동작은 익명 요청에 403을 주는데, 그러면 클라이언트가 "토큰 만료"와
        // "권한 거부"를 상태 코드로 구분할 수 없다. HttpStatusEntryPoint 설정이 살아 있어야 한다.
        mvc.perform(get("/api/notices"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("익명 요청은 관리자 경로에서도 401을 받는다")
    void anonymousAdminRequestGets401() throws Exception {
        mvc.perform(get("/api/admin/users"))
                .andExpect(status().isUnauthorized());
    }

    // ── 로그인은 됐지만 권한이 없는 요청 ──────────────────────────────

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("일반 사용자의 관리자 경로 접근은 code=FORBIDDEN이 실린 403이다")
    void userCannotReachAdminApi() throws Exception {
        // code를 빼먹으면 client.ts가 이 403을 토큰 만료로 오인해
        // 멀쩡히 로그인한 사용자를 로그아웃시킨다.
        mvc.perform(get("/api/admin/users"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("일반 사용자는 공지를 작성할 수 없다 — @EnableMethodSecurity 회귀 방지")
    void userCannotCreateNotice() throws Exception {
        // 이 테스트가 잡는 사고: SecurityConfig에서 @EnableMethodSecurity가 사라지면
        // @PreAuthorize가 조용히 무시된다. 여기서는 경로 규칙이 한 번 더 막지만,
        // 두 겹이 모두 살아 있는지 확인하는 것이 목적이다.
        mvc.perform(post("/api/notices")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"t\",\"content\":\"c\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("일반 사용자는 공지를 삭제할 수 없다")
    void userCannotDeleteNotice() throws Exception {
        mvc.perform(delete("/api/notices/1"))
                .andExpect(status().isForbidden());
    }

    // ── @PreAuthorize만으로 보호되는 곳 ──────────────────────────────

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("일반 사용자는 잔업 전체 목록을 볼 수 없다 — @EnableMethodSecurity 회귀 방지")
    void userCannotListAllOvertimeRecords() throws Exception {
        // 이 경로는 SecurityConfig에 규칙이 없다. 오직 컨트롤러의 @PreAuthorize만이
        // 막고 있으므로, @EnableMethodSecurity가 빠지면 이 테스트가 바로 깨진다.
        // (공지 작성은 경로 규칙이 이중으로 막고 있어 같은 사고를 잡지 못한다.)
        mvc.perform(get("/api/overtime-records"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("일반 사용자는 잔업을 일괄 등록할 수 없다")
    void userCannotBulkCreateOvertimeRecords() throws Exception {
        mvc.perform(post("/api/overtime-records/bulk")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userIds\":[1],\"workDate\":\"2026-08-31\",\"type\":\"OVERTIME\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("관리자는 잔업 전체 목록을 볼 수 있다")
    void adminCanListAllOvertimeRecords() throws Exception {
        // 위 두 테스트가 "전부 막혀서" 통과하는 것이 아님을 확인한다.
        mvc.perform(get("/api/overtime-records"))
                .andExpect(status().isOk());
    }

    // ── 경로 매처의 경계 ──────────────────────────────────────────────

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("댓글 삭제는 공지 삭제 규칙에 걸리지 않는다")
    void userCanReachCommentDeletion() throws Exception {
        // SecurityConfig의 "/api/notices/*"는 한 세그먼트만 매치해야 한다.
        // 이게 "/**"로 바뀌면 일반 사용자가 자기 댓글도 못 지운다.
        // 반환 타입이 ResponseEntity<?>라 when(...).thenReturn(...)은 와일드카드 캡처에 걸린다
        org.mockito.Mockito.doReturn(org.springframework.http.ResponseEntity.ok(java.util.Map.of("deleted", true)))
                .when(noticeService).deleteComment(1L, 2L);

        mvc.perform(delete("/api/notices/1/comments/2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deleted").value(true));
    }

    // ── 인증 없이 열려 있어야 하는 곳 ─────────────────────────────────

    @Test
    @DisplayName("로그인 엔드포인트는 인증 없이 도달한다")
    void loginIsPubliclyReachable() throws Exception {
        // 401/403이 아니면 시큐리티를 통과해 컨트롤러까지 갔다는 뜻이다.
        // 본문까지 확인해야 "시큐리티가 막은 401"과 구분된다. 이 메시지는
        // 컨트롤러까지 도달했을 때만 나온다.
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"kim\",\"password\":\"secret12\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("아이디 또는 비밀번호가 올바르지 않습니다."));
    }

    // ── 제거된 엔드포인트 ─────────────────────────────────────────────

    @Test
    @DisplayName("아이디+이메일만으로 비밀번호를 바꾸던 엔드포인트는 존재하지 않는다")
    void identityResetEndpointIsGone() throws Exception {
        // 인증 없이 호출 가능하고 이메일 소유를 확인하지 않아 계정 탈취 경로였다.
        // 되살아나면 이 테스트가 깨진다.
        mvc.perform(post("/api/auth/reset-by-identity")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"kim\",\"email\":\"kim@example.com\",\"newPassword\":\"newpass12\"}"))
                .andExpect(status().isNotFound());
    }
}
