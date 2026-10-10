import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, apiUpload } from '../api/client'
import { listMyOvertimeRecords } from '../api/overtimeRecords'
import { clearToken, saveAvatarUrl, saveDisplayName } from '../auth/token'
import { useConfirm } from '../components/ConfirmDialog'
import PasswordStrength from '../components/PasswordStrength'
import UserAvatar from '../components/UserAvatar'
import { formatMinutes, toYmd } from '../utils/formatDate'
import '../styles/profile.css'

interface UserProfile {
  username: string
  email: string
  displayName: string
  avatarUrl?: string | null
  roles: string[]
  status?: string
  /** 탈퇴를 신청한 시각. 신청 상태가 아니면 null */
  withdrawRequestedAt?: string | null
  withdrawReason?: string | null
}

interface MonthWorkSummary {
  overtimeMinutes: number
  specialMinutes: number
  pendingCount: number
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { alert } = useConfirm()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  /** 승인된 잔업·특근과 대기 건수. null이면 아직 못 불러왔거나 실패한 것 */
  const [monthSummary, setMonthSummary] = useState<MonthWorkSummary | null>(null)

  // Edit Display Name state
  const [displayName, setDisplayName] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)

  // Email update requires the current password because this installation does not send mail.
  const [emailDraft, setEmailDraft] = useState('')
  const [emailConfirmation, setEmailConfirmation] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)

  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const avatarPreviewRef = useRef<string | null>(null)

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  // 목업처럼 토글 하나로 세 칸을 함께 보인다/숨긴다
  const [showPasswords, setShowPasswords] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // 회원 탈퇴 state
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawPassword, setWithdrawPassword] = useState('')
  const [withdrawReason, setWithdrawReason] = useState('')
  const [withdrawError, setWithdrawError] = useState('')
  const [withdrawBusy, setWithdrawBusy] = useState(false)

  useEffect(() => {
    loadProfile()
    loadMonthOvertime()
  }, [])

  useEffect(() => () => {
    if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current)
  }, [])

  async function loadProfile() {
    try {
      setLoading(true)
      const data = await apiFetch('/api/users/me')
      setProfile(data as UserProfile)
      setDisplayName((data as UserProfile).displayName || '')
      setEmailDraft((data as UserProfile).email || '')
      saveAvatarUrl((data as UserProfile).avatarUrl ?? null)
    } catch (e: any) {
      setError(e.message || '프로필을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 요약 헤더의 지표용. useDashboardData와 같은 이번 달 범위를 쓴다.
  async function loadMonthOvertime() {
    const now = new Date()
    const from = toYmd(new Date(now.getFullYear(), now.getMonth(), 1))
    const to = toYmd(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    try {
      const records = await listMyOvertimeRecords(from, to)
      const approved = records.filter((record) => record.status === 'APPROVED')
      setMonthSummary({
        overtimeMinutes: approved
          .filter((record) => record.type === 'OVERTIME')
          .reduce((sum, record) => sum + record.totalMinutes, 0),
        specialMinutes: approved
          .filter((record) => record.type === 'SPECIAL')
          .reduce((sum, record) => sum + record.totalMinutes, 0),
        pendingCount: records.filter((record) => record.status === 'PENDING').length,
      })
    } catch {
      // 지표는 부가 정보다. 실패하면 조용히 감춘다.
      setMonthSummary(null)
    }
  }

  async function handleUpdateProfile() {
    try {
      setError('')
      setSuccessMsg('')
      const res = (await apiFetch('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify({ displayName })
      })) as UserProfile
      setProfile(res)
      // 헤더 유저 칩이 재로그인까지 옛 이름을 물고 있지 않도록 같이 갱신한다
      saveDisplayName(res.displayName)
      setSuccessMsg('표시 이름을 저장했습니다.')
      setIsEditingName(false)
    } catch (e: any) {
      setError(e.message || '프로필 업데이트 실패')
    }
  }

  async function handleUpdateEmail() {
    setEmailError('')
    setEmailSuccess('')
    const email = emailDraft.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('올바른 이메일 주소를 입력해 주세요.')
      return
    }
    if (email.toLowerCase() !== emailConfirmation.trim().toLowerCase()) {
      setEmailError('새 이메일 주소가 서로 일치하지 않습니다.')
      return
    }
    if (!emailPassword) {
      setEmailError('현재 비밀번호를 입력해 주세요.')
      return
    }

    try {
      setEmailBusy(true)
      const updated = await apiFetch('/api/users/me/email', {
        method: 'PUT',
        body: JSON.stringify({ email, currentPassword: emailPassword }),
      }) as UserProfile
      setProfile(updated)
      setEmailDraft(updated.email)
      setEmailConfirmation('')
      setEmailPassword('')
      setIsEditingEmail(false)
      setEmailSuccess('이메일 주소를 변경했습니다. 새 주소는 별도 인증되지 않았습니다.')
    } catch (e: unknown) {
      setEmailError(e instanceof Error ? e.message : '이메일 변경에 실패했습니다.')
    } finally {
      setEmailBusy(false)
    }
  }

  async function handleAvatarSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setAvatarError('')
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setAvatarError('PNG, JPG, WebP 또는 GIF 이미지만 업로드할 수 있습니다.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('프로필 사진은 5MB 이하로 업로드해 주세요.')
      return
    }

    const preview = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null
    avatarPreviewRef.current = preview
    setAvatarPreviewUrl(preview)

    const form = new FormData()
    form.append('file', file)
    try {
      setAvatarBusy(true)
      const updated = await apiUpload<UserProfile>('/api/users/me/avatar', form)
      setProfile(updated)
      saveAvatarUrl(updated.avatarUrl ?? null)
      await alert({
        title: '프로필 사진 변경 완료',
        message: '프로필 사진을 변경했습니다.',
      })
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : '프로필 사진 업로드에 실패했습니다.')
    } finally {
      if (preview) URL.revokeObjectURL(preview)
      if (avatarPreviewRef.current === preview) avatarPreviewRef.current = null
      setAvatarPreviewUrl(null)
      setAvatarBusy(false)
    }
  }

  async function handleRemoveAvatar() {
    setAvatarError('')
    try {
      setAvatarBusy(true)
      const updated = await apiFetch('/api/users/me/avatar', { method: 'DELETE' }) as UserProfile
      setProfile(updated)
      saveAvatarUrl(updated.avatarUrl ?? null)
      await alert({
        title: '프로필 사진 삭제 완료',
        message: '프로필 사진을 삭제했습니다.',
      })
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : '프로필 사진 삭제에 실패했습니다.')
    } finally {
      setAvatarBusy(false)
    }
  }

  async function handleChangePassword() {
    try {
      setPwError('')
      setPwSuccess('')

      if (newPassword.length < 8) {
        setPwError('새 비밀번호는 8자 이상이어야 합니다.')
        return
      }
      if (newPassword !== confirmPassword) {
        setPwError('새 비밀번호가 일치하지 않습니다.')
        return
      }

      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      })

      const notice = '비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해 주세요.'
      setPwSuccess(notice)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      // 서버는 비밀번호 변경 직후 발급된 모든 토큰을 무효화한다.
      clearToken()
      navigate('/login', { replace: true, state: { notice } })
    } catch (e: any) {
      setPwError(e.message || '비밀번호 변경 실패')
    }
  }

  function closePasswordChange() {
    setIsChangingPassword(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPwError('')
    setPwSuccess('')
    setShowPasswords(false)
  }

  function handleLogout() {
    clearToken()
    navigate('/')
  }

  // 신청만 남기고 로그아웃하지 않는다. 관리자가 확정하기 전까지 본인이 취소할 수 있어야 한다.
  async function handleRequestWithdraw() {
    try {
      setWithdrawError('')
      setWithdrawBusy(true)
      await apiFetch('/api/users/me/withdraw', {
        method: 'POST',
        body: JSON.stringify({ password: withdrawPassword, reason: withdrawReason }),
      })
      setWithdrawOpen(false)
      setWithdrawPassword('')
      setWithdrawReason('')
      await loadProfile()
    } catch (e: any) {
      setWithdrawError(e.message || '탈퇴 신청에 실패했습니다.')
    } finally {
      setWithdrawBusy(false)
    }
  }

  async function handleCancelWithdraw() {
    try {
      setWithdrawError('')
      setWithdrawBusy(true)
      await apiFetch('/api/users/me/withdraw', { method: 'DELETE' })
      setWithdrawOpen(false)
      setWithdrawReason('')
      await loadProfile()
    } catch (e: any) {
      setWithdrawError(e.message || '탈퇴 신청 취소에 실패했습니다.')
    } finally {
      setWithdrawBusy(false)
    }
  }

  function toggleWithdrawPanel() {
    if (withdrawOpen) {
      setWithdrawOpen(false)
      setWithdrawPassword('')
      setWithdrawReason('')
      setWithdrawError('')
      return
    }
    setWithdrawError('')
    setWithdrawOpen(true)
  }

  if (loading) return <div className="fl-page">로딩 중...</div>

  const role = profile?.roles?.[0] ?? 'USER'
  const profileLabel = profile?.displayName || profile?.username || '사용자'
  const pwType = showPasswords ? 'text' : 'password'
  const pwToggleLabel = showPasswords ? '숨기기' : '보기'
  const match = confirmPassword.length > 0 && confirmPassword === newPassword
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword
  // SUPER_ADMIN이 스스로 나가면 아무도 가입·탈퇴를 승인할 수 없게 된다
  const isSuperAdmin = profile?.roles?.includes('SUPER_ADMIN') ?? false
  const withdrawRequested = profile?.status === 'WITHDRAW_REQUESTED'
  const requestedAtText = profile?.withdrawRequestedAt
    ? new Date(profile.withdrawRequestedAt).toLocaleString('ko-KR')
    : ''

  const toggleButton = (
    <button
      type="button"
      className="pf-pw-toggle"
      onClick={() => setShowPasswords((v) => !v)}
      title={showPasswords ? '비밀번호 숨기기' : '비밀번호 보기'}
    >
      {pwToggleLabel}
    </button>
  )

  return (
    <div className="fl-page pf-page">
      {/* 요약 헤더 */}
      <section className="fl-card pf-summary">
        <div className="pf-summary-identity">
          <div className="pf-avatar-stack">
            <div className="pf-avatar-control">
              <UserAvatar
                className="pf-avatar"
                src={avatarPreviewUrl ?? profile?.avatarUrl}
                label={`${profileLabel} 프로필 사진`}
                size="lg"
              />
              <button
                type="button"
                className="pf-avatar-change"
                aria-label={profile?.avatarUrl ? '프로필 사진 변경' : '프로필 사진 업로드'}
                title={avatarBusy ? '사진 저장 중' : profile?.avatarUrl ? '프로필 사진 변경' : '프로필 사진 업로드'}
                disabled={avatarBusy}
                onClick={() => avatarInputRef.current?.click()}
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 8h3l1.5-2h7L17 8h3v11H4V8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                  <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.7" />
                </svg>
              </button>
            </div>
            <input
              ref={avatarInputRef}
              className="pf-avatar-file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              aria-label="프로필 사진 파일 선택"
              onChange={handleAvatarSelected}
            />
            {profile?.avatarUrl && (
              <button
                type="button"
                className="pf-avatar-remove"
                disabled={avatarBusy}
                onClick={handleRemoveAvatar}
              >
                사진 삭제
              </button>
            )}
          </div>
          <div className="pf-identity">
            <div className="pf-name-line">
              <span className="pf-name">{profileLabel}</span>
              <span className="fl-badge">{role}</span>
            </div>
          </div>
        </div>
        {monthSummary !== null && (
          <div className="pf-metrics" aria-label="이번 달 승인 실적">
            <div className="pf-metrics-title">이번 달 승인 실적</div>
            <div className="pf-metrics-grid">
              <div className="pf-metric is-overtime">
                <div className="pf-metric-label">잔업</div>
                <div className="pf-metric-value">
                  {monthSummary.overtimeMinutes > 0 ? formatMinutes(monthSummary.overtimeMinutes) : '없음'}
                </div>
              </div>
              <div className="pf-metric is-special">
                <div className="pf-metric-label">특근</div>
                <div className="pf-metric-value">
                  {monthSummary.specialMinutes > 0 ? formatMinutes(monthSummary.specialMinutes) : '없음'}
                </div>
              </div>
            </div>
            {monthSummary.pendingCount > 0 && (
              <div className="pf-pending-note">승인 대기 {monthSummary.pendingCount}건은 합계에서 제외</div>
            )}
          </div>
        )}
        {avatarBusy && <div className="pf-note pf-summary-feedback" role="status">프로필 사진 저장 중…</div>}
        {avatarError && (
          <div className="pf-note pf-summary-feedback" role="alert">
            <span className="pf-glyph">!</span>{avatarError}
          </div>
        )}
      </section>

      <div className="pf-cols">
        {/* 계정 정보 */}
        <section className="fl-card">
          <div className="fl-card-head">
            <span className="fl-card-title">계정 정보</span>
          </div>
          <div className="pf-rows">
            <div className="pf-row">
              <span className="pf-row-label">아이디</span>
              <span className="pf-row-value">{profile?.username}</span>
            </div>
            <div className="pf-emailfield">
              <div className="pf-namefield-head">
                <span className="pf-row-label">이메일</span>
                {!isEditingEmail && (
                  <button
                    type="button"
                    className="fl-btn fl-btn-sm"
                    onClick={() => {
                      setEmailDraft(profile?.email || '')
                      setEmailConfirmation('')
                      setEmailPassword('')
                      setEmailError('')
                      setEmailSuccess('')
                      setIsEditingEmail(true)
                    }}
                  >
                    이메일 수정
                  </button>
                )}
              </div>

              {isEditingEmail ? (
                <form
                  className="pf-emailedit"
                  onSubmit={(e) => { e.preventDefault(); void handleUpdateEmail() }}
                >
                  <div className="fl-field">
                    <label className="fl-field-label" htmlFor="pf-email-new">새 이메일</label>
                    <input
                      id="pf-email-new"
                      className="fl-input"
                      type="email"
                      autoComplete="email"
                      value={emailDraft}
                      onChange={(e) => setEmailDraft(e.target.value)}
                      required
                    />
                  </div>
                  <div className="fl-field">
                    <label className="fl-field-label" htmlFor="pf-email-confirm">새 이메일 확인</label>
                    <input
                      id="pf-email-confirm"
                      className="fl-input"
                      type="email"
                      autoComplete="off"
                      value={emailConfirmation}
                      onChange={(e) => setEmailConfirmation(e.target.value)}
                      required
                    />
                  </div>
                  <div className="fl-field">
                    <label className="fl-field-label" htmlFor="pf-email-password">변경 확인용 현재 비밀번호</label>
                    <input
                      id="pf-email-password"
                      className="fl-input"
                      type="password"
                      autoComplete="current-password"
                      value={emailPassword}
                      onChange={(e) => setEmailPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="pf-note is-warn">
                    <span className="pf-glyph">!</span>
                    메일 인증 없이 즉시 변경됩니다. 새 주소의 철자를 확인해 주세요.
                  </div>
                  <div className="pf-email-actions">
                    <button className="fl-btn fl-btn-primary" type="submit" disabled={emailBusy}>
                      {emailBusy ? '저장 중...' : '이메일 변경'}
                    </button>
                    <button
                      className="fl-btn"
                      type="button"
                      disabled={emailBusy}
                      onClick={() => {
                        setIsEditingEmail(false)
                        setEmailDraft(profile?.email || '')
                        setEmailConfirmation('')
                        setEmailPassword('')
                        setEmailError('')
                      }}
                    >
                      취소
                    </button>
                  </div>
                  {emailError && <div className="pf-note"><span className="pf-glyph">!</span>{emailError}</div>}
                </form>
              ) : (
                <div className="pf-email-value">{profile?.email || '—'}</div>
              )}
              {emailSuccess && <div className="pf-note is-ok"><span className="pf-glyph">✓</span>{emailSuccess}</div>}
            </div>
            <div className="pf-row">
              <span className="pf-row-label">권한</span>
              <span className="fl-badge fl-tone-primary">{profile?.roles?.join(', ')}</span>
            </div>

            <div className="pf-namefield">
              <div className="pf-namefield-head">
                <span className="pf-row-label">표시 이름</span>
                {!isEditingName && (
                  <button className="fl-btn fl-btn-sm" onClick={() => setIsEditingName(true)}>
                    수정
                  </button>
                )}
              </div>

              {isEditingName ? (
                <div className="pf-nameedit">
                  <input
                    className="fl-input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    aria-label="표시 이름"
                  />
                  <button className="fl-btn fl-btn-primary" onClick={handleUpdateProfile}>
                    저장
                  </button>
                  <button
                    className="fl-btn"
                    onClick={() => {
                      setIsEditingName(false)
                      setDisplayName(profile?.displayName || '')
                      setError('')
                    }}
                  >
                    취소
                  </button>
                </div>
              ) : (
                <div className="pf-namefield-value">{profile?.displayName || '—'}</div>
              )}

              {error && (
                <div className="pf-note">
                  <span className="pf-glyph">!</span>
                  {error}
                </div>
              )}
              {successMsg && (
                <div className="pf-note is-ok">
                  <span className="pf-glyph">✓</span>
                  {successMsg}
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="pf-security-column">
        {/* 비밀번호 변경은 필요할 때만 펼친다 */}
        <section className="fl-card pf-security-card">
          <div className="fl-card-head pf-security-head">
            <div className="pf-security-copy">
              <span className="fl-card-title">비밀번호 변경</span>
              {!isChangingPassword && (
                <span className="pf-security-sub">현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다.</span>
              )}
            </div>
            <button
              type="button"
              className="fl-btn fl-btn-sm"
              aria-expanded={isChangingPassword}
              aria-controls="pf-password-panel"
              onClick={() => isChangingPassword ? closePasswordChange() : setIsChangingPassword(true)}
            >
              {isChangingPassword ? '닫기' : '변경하기'}
            </button>
          </div>
          <div id="pf-password-panel" hidden={!isChangingPassword}>
            {isChangingPassword && (
              <div className="fl-card-body pf-pwbody">
              <div className="fl-field">
                <label className="fl-field-label" htmlFor="pf-current">
                  현재 비밀번호
                </label>
                <div className="pf-pw-wrap">
                  <input
                    id="pf-current"
                    type={pwType}
                    className="fl-input"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="현재 비밀번호"
                  />
                  {toggleButton}
                </div>
              </div>

              <div className="fl-field">
                <label className="fl-field-label" htmlFor="pf-new">
                  새 비밀번호
                </label>
                <div className="pf-pw-wrap">
                  <input
                    id="pf-new"
                    type={pwType}
                    className="fl-input"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="8자 이상"
                  />
                  {toggleButton}
                </div>
                <PasswordStrength password={newPassword} />
                <div className="pf-rules">
                  <span className={`pf-rule ${newPassword.length >= 8 ? 'is-met' : ''}`}>
                    8자 이상
                  </span>
                  <span className={`pf-rule ${/[0-9]/.test(newPassword) ? 'is-met' : ''}`}>
                    숫자 포함
                  </span>
                  <span className={`pf-rule ${/[^a-zA-Z0-9]/.test(newPassword) ? 'is-met' : ''}`}>
                    기호 포함
                  </span>
                </div>
              </div>

              <div className="fl-field">
                <label className="fl-field-label" htmlFor="pf-confirm">
                  새 비밀번호 확인
                </label>
                <input
                  id="pf-confirm"
                  type={pwType}
                  className={`fl-input pf-confirm ${
                    match ? 'is-match' : mismatch ? 'is-mismatch' : ''
                  }`}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="한 번 더 입력"
                />
                {match && (
                  <div className="pf-note is-ok">
                    <span className="pf-glyph">✓</span>
                    비밀번호가 일치합니다
                  </div>
                )}
                {mismatch && (
                  <div className="pf-note">
                    <span className="pf-glyph">!</span>
                    비밀번호가 일치하지 않습니다
                  </div>
                )}
              </div>

              <div className="pf-pw-actions">
                <button
                  className="fl-btn fl-btn-primary"
                  onClick={handleChangePassword}
                  disabled={!currentPassword || !newPassword || !confirmPassword}
                >
                  비밀번호 변경
                </button>
                <button className="fl-btn" type="button" onClick={closePasswordChange}>
                  취소
                </button>
              </div>

              {pwError && (
                <div className="pf-note">
                  <span className="pf-glyph">!</span>
                  {pwError}
                </div>
              )}
              {pwSuccess && (
                <div className="pf-note is-ok">
                  <span className="pf-glyph">✓</span>
                  {pwSuccess}
                </div>
              )}
              </div>
            )}
          </div>
        </section>
          {/* 비밀번호 변경과 로그아웃을 보안·세션 영역에 묶는다. */}
          <section className="fl-card pf-logout">
            <div>
              <div className="pf-logout-title">이 기기에서 로그아웃</div>
              <div className="pf-logout-sub">공용 PC라면 사용 후 반드시 로그아웃하세요.</div>
            </div>
            <button className="fl-btn fl-btn-danger" onClick={handleLogout}>
              로그아웃
            </button>
          </section>
        </div>
      </div>

      {/* 회원 탈퇴 */}
      {!isSuperAdmin && (
        <section className="fl-card pf-danger">
          <div className="fl-card-head pf-danger-head">
            <div className="pf-danger-heading">
              <span className="fl-card-title">회원 탈퇴</span>
              <span className="pf-danger-sub">
                {withdrawRequested
                  ? '탈퇴를 신청했습니다 · 관리자 확정 전까지 취소할 수 있습니다.'
                  : '관리자 확인 후 확정됩니다. 근로 기록은 보존됩니다.'}
              </span>
            </div>
            <button
              type="button"
              className="fl-btn fl-btn-sm"
              aria-expanded={withdrawOpen}
              aria-controls="pf-withdraw-panel"
              onClick={toggleWithdrawPanel}
            >
              {withdrawOpen ? '접기' : withdrawRequested ? '상세 보기' : '회원 탈퇴 신청'}
            </button>
          </div>
          <div id="pf-withdraw-panel" hidden={!withdrawOpen}>
            {withdrawOpen && (
              <div className="fl-card-body pf-danger-body">
                {withdrawRequested ? (
                  <>
                    <div className="pf-withdraw-meta">
                      <span>신청 {requestedAtText || '—'}</span>
                      {profile?.withdrawReason && <span>사유: {profile.withdrawReason}</span>}
                    </div>
                    <button className="fl-btn" onClick={handleCancelWithdraw} disabled={withdrawBusy}>
                      탈퇴 신청 취소
                    </button>
                  </>
                ) : (
                  <>
                    <p className="pf-danger-desc">
                      확정되면 로그인할 수 없고 같은 아이디로 재가입할 수 없습니다. 근로 기록은 보존됩니다.
                    </p>
                    <div className="fl-field">
                      <label className="fl-field-label" htmlFor="pf-wd-pw">
                        본인 확인을 위해 현재 비밀번호를 입력하세요
                      </label>
                      <input
                        id="pf-wd-pw"
                        type="password"
                        className="fl-input"
                        autoComplete="current-password"
                        value={withdrawPassword}
                        onChange={(e) => setWithdrawPassword(e.target.value)}
                        placeholder="현재 비밀번호"
                      />
                    </div>

                    <div className="fl-field">
                      <label className="fl-field-label" htmlFor="pf-wd-reason">
                        탈퇴 사유 (선택)
                      </label>
                      <textarea
                        id="pf-wd-reason"
                        className="fl-input pf-danger-reason"
                        rows={3}
                        value={withdrawReason}
                        onChange={(e) => setWithdrawReason(e.target.value)}
                        placeholder="관리자에게 전달할 내용이 있다면 적어 주세요"
                      />
                    </div>

                    <div className="pf-danger-actions">
                      <button
                        className="fl-btn fl-btn-danger"
                        onClick={handleRequestWithdraw}
                        disabled={!withdrawPassword || withdrawBusy}
                      >
                        탈퇴 신청하기
                      </button>
                      <button className="fl-btn" onClick={toggleWithdrawPanel}>
                        취소
                      </button>
                    </div>
                  </>
                )}
                {withdrawError && (
                  <div className="pf-note">
                    <span className="pf-glyph">!</span>
                    {withdrawError}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
