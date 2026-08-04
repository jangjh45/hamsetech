package com.hamsetech.hamsetech.user;

import com.hamsetech.hamsetech.admin.AdminLog;
import com.hamsetech.hamsetech.admin.AdminLogService;
import com.hamsetech.hamsetech.scenario.PackingScenarioRepository;
import com.hamsetech.hamsetech.todo.TodoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * 회원 탈퇴 확정 처리.
 *
 * 행을 지우지 않는 소프트 탈퇴다. overtime_records가 users를 FK 없이 참조하고 있어
 * 하드 삭제하면 조용히 고아 데이터가 되고, 근로 기록은 보존해야 하기 때문이다.
 * 대신 로그인에 쓰이는 값과 개인정보를 익명화해 계정을 되살릴 수 없게 만든다.
 *
 * 본인 신청 경로와 관리자 직접 처리 경로가 이 클래스를 함께 쓴다.
 */
@Service
public class UserWithdrawalService {

    private static final Logger logger = LoggerFactory.getLogger(UserWithdrawalService.class);

    /** 탈퇴 확정 주체가 사용자 본인의 신청이 아니라 관리자 단독 처리일 때와 구분하기 위한 값. */
    public static final String ACTOR_SELF = "SELF";

    private final UserAccountRepository userRepo;
    private final TodoRepository todoRepo;
    private final PackingScenarioRepository scenarioRepo;
    private final PasswordEncoder passwordEncoder;
    private final AdminLogService adminLogService;

    public UserWithdrawalService(UserAccountRepository userRepo,
                                 TodoRepository todoRepo,
                                 PackingScenarioRepository scenarioRepo,
                                 PasswordEncoder passwordEncoder,
                                 AdminLogService adminLogService) {
        this.userRepo = userRepo;
        this.todoRepo = todoRepo;
        this.scenarioRepo = scenarioRepo;
        this.passwordEncoder = passwordEncoder;
        this.adminLogService = adminLogService;
    }

    /** 호출부가 400으로 변환한다. */
    public static class WithdrawalNotAllowedException extends RuntimeException {
        public WithdrawalNotAllowedException(String message) {
            super(message);
        }
    }

    /**
     * 탈퇴를 확정한다. 이미 탈퇴한 계정이면 아무 것도 하지 않는다(멱등).
     *
     * @param actor 처리 주체. {@link #ACTOR_SELF} 또는 관리자 username
     * @param reason 관리자가 남긴 사유. 비어 있으면 사용자가 신청 시 적은 사유를 유지한다
     */
    @Transactional
    public void confirmWithdraw(UserAccount user, String actor, String reason) {
        if (user.isSuperAdmin()) {
            throw new WithdrawalNotAllowedException("SUPER_ADMIN 계정은 탈퇴할 수 없습니다.");
        }
        if (user.isWithdrawn()) {
            return;
        }

        String originalUsername = user.getUsername();
        Long id = user.getId();

        // 타인에게 노출되지 않는 개인 콘텐츠다. 업무 기록 가치가 없으므로 함께 지운다.
        todoRepo.deleteByUser(user);
        scenarioRepo.deleteByUser(user);

        // username/email/display_name이 전부 UNIQUE라 익명화 값에 id를 섞어야 충돌하지 않는다.
        // username은 그대로 둔다. 잔업·공지·캘린더가 username 문자열로 작성자를 식별하므로
        // 자리를 비우면 같은 아이디로 재가입한 사람이 옛 사용자의 기록을 물려받는다.
        user.setEmail("withdrawn+" + id + "@invalid.local");
        user.setDisplayName("탈퇴한 사용자(" + id + ")");
        // status 판정에 구멍이 생기더라도 로그인은 불가능하게 만든다
        user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        // 관리자 권한을 회수한다. @ElementCollection은 컬렉션 인스턴스를 갈아끼우는 것보다
        // 제자리에서 고치는 편이 안전하다.
        user.getRoles().clear();
        user.getRoles().add(UserRole.USER);

        user.setStatus(UserStatus.WITHDRAWN);
        user.setWithdrawnAt(Instant.now());
        user.setWithdrawnBy(actor);
        if (reason != null && !reason.isBlank()) {
            user.setWithdrawReason(reason.trim());
        }
        userRepo.save(user);

        adminLogService.logSystemAction(actor, AdminLog.Action.DELETE, AdminLog.EntityType.USER, id,
                "회원 탈퇴 확정 | username=" + originalUsername + " | by=" + actor
                        + (user.getWithdrawReason() == null ? "" : " | 사유=" + user.getWithdrawReason()));
        logger.info("Withdrew user account: {} (by {})", originalUsername, actor);
    }

    /** 탈퇴 신청을 되돌린다. 본인 취소와 관리자 반려가 같은 경로를 쓴다. */
    @Transactional
    public void cancelWithdrawRequest(UserAccount user) {
        if (!user.isWithdrawRequested()) {
            throw new WithdrawalNotAllowedException("탈퇴 신청 상태가 아닙니다.");
        }
        user.setStatus(UserStatus.APPROVED);
        user.setWithdrawRequestedAt(null);
        user.setWithdrawReason(null);
        userRepo.save(user);
    }
}


