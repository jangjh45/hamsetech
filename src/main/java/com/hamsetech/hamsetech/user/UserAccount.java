package com.hamsetech.hamsetech.user;

import jakarta.persistence.*;
import org.hibernate.annotations.BatchSize;
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

    /** 서버 생성 이미지 저장 경로와 난수 공개 키. 실제 파일명은 API 응답에 노출하지 않는다. */
    @Column(name = "avatar_path", length = 255)
    private String avatarPath;

    @Column(name = "avatar_content_type", length = 100)
    private String avatarContentType;

    @Column(name = "avatar_key", length = 36, unique = true)
    private String avatarKey;

    /**
     * EAGER를 유지한다. 인증 필터와 UserDetailsService가 트랜잭션 밖에서 이 값을
     * 읽으므로 LAZY로 바꾸면 인증 경로가 통째로 깨진다.
     *
     * 대신 @BatchSize로 N+1을 접는다. 사용자 목록처럼 여러 계정을 한 번에 읽을 때
     * EAGER @ElementCollection은 계정마다 SELECT를 한 번씩 더 날리는데, 배치로 묶으면
     * 50명당 한 번이 된다. 역할은 계정당 많아야 서너 개라 함께 읽어도 부담이 없다.
     */
    @ElementCollection(fetch = FetchType.EAGER)
    @BatchSize(size = 50)
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
     * Version captured in each authenticated session. Password resets and
     * confirmed withdrawals increment it so the request filter can revoke all
     * sessions for the account without maintaining a separate session registry.
     */
    @Column(name = "auth_version")
    private Integer authVersion = 0;

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getAvatarPath() { return avatarPath; }
    public void setAvatarPath(String avatarPath) { this.avatarPath = avatarPath; }
    public String getAvatarContentType() { return avatarContentType; }
    public void setAvatarContentType(String avatarContentType) { this.avatarContentType = avatarContentType; }
    public String getAvatarKey() { return avatarKey; }
    public void setAvatarKey(String avatarKey) { this.avatarKey = avatarKey; }
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

    /** 기존 행의 NULL은 최초 버전 0으로 읽는다. */
    public int getAuthVersion() { return authVersion == null ? 0 : authVersion; }

    /** 이 계정의 기존 세션을 다음 요청에서 전부 무효화한다. */
    public void bumpAuthVersion() { this.authVersion = getAuthVersion() + 1; }

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


