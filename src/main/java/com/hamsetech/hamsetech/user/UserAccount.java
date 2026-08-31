package com.hamsetech.hamsetech.user;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users")
public class UserAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String username;

    @Column(nullable = false, unique = true, length = 200)
    private String email;

    @Column(nullable = false, length = 200)
    private String passwordHash;

    @Column(name = "display_name", length = 120, unique = true)
    private String displayName;

    @ElementCollection(fetch = FetchType.EAGER)
    @Enumerated(EnumType.STRING)
    @CollectionTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "role")
    private Set<UserRole> roles = new HashSet<>();

    // nullable=false를 걸지 않는다. ddl-auto=update는 기존 테이블에 NOT NULL 컬럼을
    // 추가하지 못해 기동이 깨진다. 컬럼 추가와 기존 행 백필은 UserStatusMigration이 맡는다.
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20)
    private UserStatus status = UserStatus.PENDING;

    // 탈퇴 관련 컬럼은 전부 nullable이다. 기존 행은 NULL이 정답이므로 백필이 필요 없고
    // ddl-auto=update가 알아서 추가한다.
    @Column(name = "withdraw_requested_at")
    private Instant withdrawRequestedAt;

    @Column(name = "withdrawn_at")
    private Instant withdrawnAt;

    @Column(name = "withdraw_reason", columnDefinition = "TEXT")
    private String withdrawReason;

    /** 탈퇴를 확정한 주체. "SELF"이거나 처리한 관리자의 username. */
    @Column(name = "withdrawn_by", length = 100)
    private String withdrawnBy;

    /**
     * 발급된 토큰의 세대. 비밀번호가 바뀌거나 탈퇴가 확정되면 1 올린다.
     *
     * JWT는 서버가 회수할 수 없어, 만료(기본 24시간) 전까지는 비밀번호를 바꿔도
     * 옛 토큰이 그대로 통했다. 인증 필터가 요청마다 이 값과 토큰의 tv 클레임을
     * 대조하므로, 값을 올리는 순간 그 계정의 기존 토큰이 전부 무효가 된다.
     *
     * 기존 행을 위해 nullable로 둔다. ddl-auto=update는 NOT NULL 컬럼을 기존
     * 테이블에 붙이지 못한다. 게터에서 NULL을 0으로 흡수한다.
     */
    @Column(name = "token_version")
    private Integer tokenVersion = 0;

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public Set<UserRole> getRoles() { return roles; }
    public void setRoles(Set<UserRole> roles) { this.roles = roles; }
    public UserStatus getStatus() { return status; }
    public void setStatus(UserStatus status) { this.status = status; }
    public Instant getWithdrawRequestedAt() { return withdrawRequestedAt; }
    public void setWithdrawRequestedAt(Instant withdrawRequestedAt) { this.withdrawRequestedAt = withdrawRequestedAt; }
    public Instant getWithdrawnAt() { return withdrawnAt; }
    public void setWithdrawnAt(Instant withdrawnAt) { this.withdrawnAt = withdrawnAt; }
    public String getWithdrawReason() { return withdrawReason; }
    public void setWithdrawReason(String withdrawReason) { this.withdrawReason = withdrawReason; }
    public String getWithdrawnBy() { return withdrawnBy; }
    public void setWithdrawnBy(String withdrawnBy) { this.withdrawnBy = withdrawnBy; }

    /** 백필 전 NULL을 0으로 읽는다. */
    public int getTokenVersion() { return tokenVersion == null ? 0 : tokenVersion; }

    /** 이 계정으로 이미 발급된 토큰을 전부 무효화한다. */
    public void bumpTokenVersion() { this.tokenVersion = getTokenVersion() + 1; }

    /** 백필 전 행은 status가 null로 읽힌다. 승인되지 않은 것으로 본다. */
    public boolean isApproved() { return status == UserStatus.APPROVED; }

    /**
     * 로그인·API 접근 가능 여부.
     * 탈퇴 신청 중에는 본인이 신청을 취소할 수 있어야 하므로 계속 허용한다.
     * 승인 여부 판정(isApproved)과 접근 판정은 이 지점부터 갈라진다.
     */
    public boolean canAccess() {
        return status == UserStatus.APPROVED || status == UserStatus.WITHDRAW_REQUESTED;
    }

    public boolean isWithdrawn() { return status == UserStatus.WITHDRAWN; }

    public boolean isWithdrawRequested() { return status == UserStatus.WITHDRAW_REQUESTED; }

    public boolean isSuperAdmin() { return roles != null && roles.contains(UserRole.SUPER_ADMIN); }
}


