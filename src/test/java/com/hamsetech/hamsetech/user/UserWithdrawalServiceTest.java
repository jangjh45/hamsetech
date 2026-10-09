package com.hamsetech.hamsetech.user;

import com.hamsetech.hamsetech.admin.AdminLogService;
import com.hamsetech.hamsetech.scenario.PackingScenarioRepository;
import com.hamsetech.hamsetech.todo.TodoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * 탈퇴 확정 처리 테스트.
 *
 * 이 클래스는 행을 지우지 않는다. 대신 로그인에 쓰이는 값과 개인정보를 익명화해
 * 계정을 되살릴 수 없게 만든다. 그래서 "잘못 뒤집으면 계정이 영영 돌아오지 않는다"는
 * 이유로 여기 각 조치가 빠짐없이 들어갔는지 확인한다.
 *
 * 특히 다음을 본다.
 * - username은 남는다. 지우면 같은 아이디로 재가입한 사람이 옛 사용자의 근로 기록을
 *   물려받는다.
 * - 토큰 세대가 올라간다. 안 오르면 탈퇴 직전 발급된 토큰이 만료(24시간)까지 살아 있다.
 * - SUPER_ADMIN은 탈퇴할 수 없다. 스스로 나가면 아무도 승인할 수 없다.
 * - 개인 콘텐츠(할일·시나리오)는 지운다. 근로 기록(잔업·공지·캘린더)은 남긴다.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UserWithdrawalServiceTest {

    @Mock private UserAccountRepository userRepo;
    @Mock private TodoRepository todoRepo;
    @Mock private PackingScenarioRepository scenarioRepo;
    @Mock private AdminLogService adminLogService;

    /** 실제로 돌린다. encode()가 같은 비밀번호를 다르게 만들어 주어야 하는지까지 본다. */
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    // @InjectMocks는 final 필드에 주입하지 못한다. 생성자로 직접 채운다.
    // @BeforeEach여야 한다 — 필드 초기화 순서로는 @Mock이 아직 null이다.
    private UserWithdrawalService service;

    @BeforeEach
    void setUp() {
        service = new UserWithdrawalService(
                userRepo, todoRepo, scenarioRepo, passwordEncoder, adminLogService);
    }

    private UserAccount user(UserRole... roles) {
        UserAccount u = new UserAccount();
        u.setUsername("kim");
        u.setEmail("kim@hamsetech.kr");
        u.setDisplayName("김철수");
        u.setPasswordHash(passwordEncoder.encode("old-password"));
        u.setRoles(new java.util.HashSet<>(java.util.Arrays.asList(roles)));
        u.setStatus(UserStatus.WITHDRAW_REQUESTED);
        u.setWithdrawReason("이직");
        ReflectionTestUtils.setField(u, "tokenVersion", 3);
        return u;
    }

    @Test
    @DisplayName("확정하면 개인정보를 익명화하고 접근을 막는다")
    void anonymizesPersonalData() {
        UserAccount u = user(UserRole.USER);

        service.confirmWithdraw(u, UserWithdrawalService.ACTOR_SELF, "이직");

        assertThat(u.getStatus()).isEqualTo(UserStatus.WITHDRAWN);
        assertThat(u.canAccess()).isFalse();
        // 개인정보는 지워지지 않고 값을 바꾼다. 같은 문자열이 남아 있으면 복원이 된다.
        assertThat(u.getEmail()).isEqualTo("withdrawn+null@invalid.local");
        assertThat(u.getDisplayName()).isEqualTo("탈퇴한 사용자(null)");
        assertThat(u.getWithdrawReason()).isEqualTo("이직");
    }

    @Test
    @DisplayName("username은 남긴다 — 같은 아이디로 재가입한 사람이 옛 기록을 물려받게 된다")
    void keepsUsername() {
        UserAccount u = user(UserRole.USER);

        service.confirmWithdraw(u, UserWithdrawalService.ACTOR_SELF, null);

        // 잔업·공지·캘린더가 username 문자열로 작성자를 식별한다.
        assertThat(u.getUsername()).isEqualTo("kim");
    }

    @Test
    @DisplayName("익명화 값에 id를 섞는다 — email/display_name은 UNIQUE라 충돌한다")
    void anonymizedValuesIncludeId() {
        // id는 생성값이라 직접 심는다.
        UserAccount u = user(UserRole.USER);
        ReflectionTestUtils.setField(u, "id", 42L);

        service.confirmWithdraw(u, UserWithdrawalService.ACTOR_SELF, null);

        // 두 계정이 같은 값을 가지면 두 번째 저장이 UNIQUE 위반으로 실패한다.
        assertThat(u.getEmail()).isEqualTo("withdrawn+42@invalid.local");
        assertThat(u.getDisplayName()).isEqualTo("탈퇴한 사용자(42)");
    }

    @Test
    @DisplayName("토큰 세대를 올려 이미 발급된 토큰을 무효화한다")
    void bumpsTokenVersion() {
        UserAccount u = user(UserRole.USER);
        assertThat(u.getTokenVersion()).isEqualTo(3);

        service.confirmWithdraw(u, UserWithdrawalService.ACTOR_SELF, null);

        // 안 올리면 탈퇴 직전 토큰이 만료(기본 24시간)까지 API를 계속 쓴다.
        assertThat(u.getTokenVersion()).isEqualTo(4);
    }

    @Test
    @DisplayName("백필 전 token_version이 null이어도 1만 올린다")
    void handlesNullTokenVersion() {
        UserAccount u = user(UserRole.USER);
        ReflectionTestUtils.setField(u, "tokenVersion", null);

        service.confirmWithdraw(u, UserWithdrawalService.ACTOR_SELF, null);

        // null로 두면 인증 필터가 숫자 비교에서 죽는다.
        assertThat(u.getTokenVersion()).isEqualTo(1);
    }

    @Test
    @DisplayName("기존 비밀번호를 바꿔 로그인이 막힌다")
    void changesPassword() {
        UserAccount u = user(UserRole.USER);
        String before = u.getPasswordHash();

        service.confirmWithdraw(u, UserWithdrawalService.ACTOR_SELF, null);

        // status 판정에 구멍이 생기더라도 로그인은 불가능해야 한다.
        assertThat(u.getPasswordHash()).isNotEqualTo(before);
        assertThat(passwordEncoder.matches("old-password", u.getPasswordHash())).isFalse();
    }

    @Test
    @DisplayName("관리자 권한을 회수하고 USER로 낮춘다")
    void revokesAdminRoles() {
        UserAccount u = user(UserRole.USER, UserRole.ADMIN);

        service.confirmWithdraw(u, "admin", null);

        // 권한이 남으면 탈퇴한 계정이 관리자 화면을 연다.
        assertThat(u.getRoles()).containsExactly(UserRole.USER);
        assertThat(u.isSuperAdmin()).isFalse();
    }

    @Test
    @DisplayName("SUPER_ADMIN은 탈퇴할 수 없다")
    void refusesSuperAdmin() {
        UserAccount u = user(UserRole.SUPER_ADMIN, UserRole.ADMIN);

        assertThatThrownBy(() -> service.confirmWithdraw(u, "admin", null))
                .isInstanceOf(UserWithdrawalService.WithdrawalNotAllowedException.class)
                .hasMessageContaining("SUPER_ADMIN");

        // 막고 나서 계정은 그대로여야 한다.
        assertThat(u.getStatus()).isEqualTo(UserStatus.WITHDRAW_REQUESTED);
        verify(userRepo, never()).save(any());
    }

    @Test
    @DisplayName("이미 탈퇴한 계정은 아무 것도 하지 않는다 (멱등)")
    void isIdempotent() {
        UserAccount u = user(UserRole.USER);
        u.setStatus(UserStatus.WITHDRAWN);
        String email = u.getEmail();

        service.confirmWithdraw(u, "admin", null);

        // 관리자가 두 번 눌러도 이메일이 다시 바뀌면 안 된다.
        assertThat(u.getEmail()).isEqualTo(email);
        verify(userRepo, never()).save(any());
    }

    @Test
    @DisplayName("개인 콘텐츠(할일·시나리오)는 함께 지운다")
    void deletesPersonalContent() {
        UserAccount u = user(UserRole.USER);

        service.confirmWithdraw(u, UserWithdrawalService.ACTOR_SELF, null);

        verify(todoRepo).deleteByUser(u);
        verify(scenarioRepo).deleteByUser(u);
    }

    @Test
    @DisplayName("근로 기록은 남긴다 — 자기가 쓴 어떤 내용인지 알 수 없어야 한다")
    void keepsWorkRecords() {
        // 이 서비스는 overtime_records에 손대지 않는다. 하드 삭제였다면 손댔을 곳이다.
        UserAccount u = user(UserRole.USER);

        service.confirmWithdraw(u, UserWithdrawalService.ACTOR_SELF, null);

        verify(userRepo, times(1)).save(any());
        // 하드 삭제였다면 delete를 썼을 곳이다. account 행이 남아 있어야 근로 기록이 남는다.
        verify(userRepo, never()).deleteById(any());
    }

    @Test
    @DisplayName("탈퇴 처리 주체와 시각을 남긴다")
    void recordsActorAndTime() {
        UserAccount u = user(UserRole.USER);
        Instant before = Instant.now();

        service.confirmWithdraw(u, "admin-han", null);

        assertThat(u.getWithdrawnBy()).isEqualTo("admin-han");
        assertThat(u.getWithdrawnAt()).isAfterOrEqualTo(before);
    }

    @Test
    @DisplayName("관리자가 사유를 비워 두면 신청자가 적은 사유를 유지한다")
    void keepsUserReasonWhenAdminGivesNone() {
        UserAccount u = user(UserRole.USER);
        u.setWithdrawReason("사업迁移");

        service.confirmWithdraw(u, "admin-han", "   ");

        // 빈 문자열로 덮어쓰면 신청자가 적은 이유가 조용히 사라진다.
        assertThat(u.getWithdrawReason()).isEqualTo("사업迁移");
    }

    @Test
    @DisplayName("관리자가 사유를 주면 그걸로 덮어쓴다")
    void adminReasonWins() {
        UserAccount u = user(UserRole.USER);

        service.confirmWithdraw(u, "admin-han", "  요청 확인  ");

        // 앞뒤 공백은 제거한다. 로그에 공백이 붙으면 검색이 안 된다.
        assertThat(u.getWithdrawReason()).isEqualTo("요청 확인");
    }

    @Test
    @DisplayName("처리 기록을 관리자 로그에 남긴다")
    void writesAdminLog() {
        UserAccount u = user(UserRole.USER);

        service.confirmWithdraw(u, "admin-han", "이직");

        // 누가 누구를 탈퇴시켰는지 남지 않으면 나중에 조사를 못 한다.
        verify(adminLogService).logSystemAction(eq("admin-han"), any(), any(),
                any(), contains("admin-han"));
    }

    @Test
    @DisplayName("신청을 취소하면 승인 상태로 되돌아간다")
    void cancelReturnsToApproved() {
        UserAccount u = user(UserRole.USER);
        u.setStatus(UserStatus.WITHDRAW_REQUESTED);
        u.setWithdrawRequestedAt(Instant.now());

        service.cancelWithdrawRequest(u);

        // 관리자 확정 전까지 본인이 되돌릴 수 있어야 한다.
        assertThat(u.getStatus()).isEqualTo(UserStatus.APPROVED);
        assertThat(u.canAccess()).isTrue();
        assertThat(u.getWithdrawRequestedAt()).isNull();
        assertThat(u.getWithdrawReason()).isNull();
    }

    @Test
    @DisplayName("신청하지 않은 계정은 취소할 수 없다")
    void refusesCancelWithoutRequest() {
        UserAccount u = user(UserRole.USER);
        u.setStatus(UserStatus.APPROVED);

        // 이미 승인된 계정을 여기서 막아야 관리자 반려는 경로가 조용히 통과하지 않는다.
        assertThatThrownBy(() -> service.cancelWithdrawRequest(u))
                .isInstanceOf(UserWithdrawalService.WithdrawalNotAllowedException.class);

        verify(userRepo, never()).save(any());
    }

    @Test
    @DisplayName("취소해도 토큰 세대를 올리지 않는다 — 계정이 계속 쓰이기 때문이다")
    void cancelDoesNotBumpTokenVersion() {
        UserAccount u = user(UserRole.USER);
        u.setStatus(UserStatus.WITHDRAW_REQUESTED);
        int before = u.getTokenVersion();

        service.cancelWithdrawRequest(u);

        // 올리면 로그인한 탭이 통째로 튕겨 나간다. 신청 취소에서 그건 아니다.
        assertThat(u.getTokenVersion()).isEqualTo(before);
    }
}