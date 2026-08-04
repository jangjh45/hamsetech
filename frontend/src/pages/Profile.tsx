import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { listMyOvertimeRecords } from '../api/overtimeRecords'
import { clearToken, saveDisplayName } from '../auth/token'
import PasswordStrength from '../components/PasswordStrength'
import { formatMinutes, toYmd } from '../utils/formatDate'
import '../styles/profile.css'

interface UserProfile {
  username: string
  email: string
  displayName: string
  roles: string[]
  status?: string
  /** 탈퇴를 신청한 시각. 신청 상태가 아니면 null */
  withdrawRequestedAt?: string | null
  withdrawReason?: string | null
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  /** 이번 달 잔업·특근 합계(분). null이면 아직 못 불러왔거나 실패한 것 */
  const [monthMinutes, setMonthMinutes] = useState<number | null>(null)

  // Edit Display Name state
  const [displayName, setDisplayName] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  // 목업처럼 토글 하나로 세 칸을 함께 보인다/숨긴다
  const [showPasswords, setShowPasswords] = useState(false)

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

  async function loadProfile() {
    try {
      setLoading(true)
      const data = await apiFetch('/api/users/me')
      setProfile(data as UserProfile)
      setDisplayName((data as UserProfile).displayName || '')
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
      setMonthMinutes(records.reduce((sum, r) => sum + r.totalMinutes, 0))
    } catch {
      // 지표는 부가 정보다. 실패하면 조용히 감춘다.
      setMonthMinutes(null)
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

      setPwSuccess('비밀번호가 변경되었습니다.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e: any) {
      setPwError(e.message || '비밀번호 변경 실패')
    }
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
      await loadProfile()
    } catch (e: any) {
      setWithdrawError(e.message || '탈퇴 신청 취소에 실패했습니다.')
    } finally {
      setWithdrawBusy(false)
    }
  }

  if (loading) return <div className="fl-page">로딩 중...</div>

  const role = profile?.roles?.[0] ?? 'USER'
  const initial = (profile?.displayName || profile?.username || '?').charAt(0)
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
        <div className="pf-avatar">{initial}</div>
        <div className="pf-identity">
          <div className="pf-name-line">
            <span className="pf-name">{profile?.displayName || profile?.username}</span>
            <span className="fl-badge">{role}</span>
          </div>
          <div className="pf-handle">
            {profile?.username} · {profile?.email}
          </div>
        </div>
        <div className="fl-spacer" />
        {monthMinutes !== null && (
          <div className="pf-metrics">
            <div className="pf-metric">
              <div className="pf-metric-label">이번 달 잔업·특근</div>
              <div className="pf-metric-value">
                {monthMinutes > 0 ? formatMinutes(monthMinutes) : '없음'}
              </div>
            </div>
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
            <div className="pf-row">
              <span className="pf-row-label">이메일</span>
              <span className="pf-row-value">{profile?.email}</span>
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

        {/* 비밀번호 변경 */}
        <section className="fl-card">
          <div className="fl-card-head">
            <span className="fl-card-title">비밀번호 변경</span>
          </div>
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

            <button
              className="fl-btn fl-btn-primary"
              onClick={handleChangePassword}
              disabled={!currentPassword || !newPassword || !confirmPassword}
            >
              비밀번호 변경
            </button>

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
        </section>
      </div>

      {/* 이 기기에서 로그아웃 */}
      <section className="fl-card pf-logout">
        <div>
          <div className="pf-logout-title">이 기기에서 로그아웃</div>
          <div className="pf-logout-sub">공용 PC라면 사용 후 반드시 로그아웃하세요.</div>
        </div>
        <button className="fl-btn fl-btn-danger" onClick={handleLogout}>
          로그아웃
        </button>
      </section>

      {/* 회원 탈퇴 */}
      {!isSuperAdmin && (
        <section className="fl-card pf-danger">
          <div className="fl-card-head">
            <span className="fl-card-title">회원 탈퇴</span>
          </div>

          {withdrawRequested ? (
            <div className="fl-card-body pf-danger-body">
              <div className="pf-note is-warn">
                <span className="pf-glyph">!</span>
                탈퇴를 신청했습니다. 관리자가 확정하면 계정을 사용할 수 없게 됩니다.
              </div>
              <div className="pf-rows">
                <div className="pf-row">
                  <span className="pf-row-label">신청 일시</span>
                  <span className="pf-row-value">{requestedAtText || '—'}</span>
                </div>
                {profile?.withdrawReason && (
                  <div className="pf-row">
                    <span className="pf-row-label">사유</span>
                    <span className="pf-row-value">{profile.withdrawReason}</span>
                  </div>
                )}
              </div>
              <p className="pf-danger-desc">
                확정 전까지는 계속 로그인할 수 있고, 아래 버튼으로 신청을 되돌릴 수 있습니다.
              </p>
              <button className="fl-btn" onClick={handleCancelWithdraw} disabled={withdrawBusy}>
                탈퇴 신청 취소
              </button>
              {withdrawError && (
                <div className="pf-note">
                  <span className="pf-glyph">!</span>
                  {withdrawError}
                </div>
              )}
            </div>
          ) : (
            <div className="fl-card-body pf-danger-body">
              <p className="pf-danger-desc">
                탈퇴를 신청하면 관리자가 확인 후 확정합니다. 확정되면 로그인할 수 없고 이메일·표시
                이름 등 개인정보가 삭제되며, <strong>같은 아이디로는 다시 가입할 수 없습니다.</strong>
                <br />
                제출한 잔업·특근 기록은 근로 기록이므로 그대로 보존됩니다.
              </p>

              {!withdrawOpen ? (
                <button className="fl-btn fl-btn-danger" onClick={() => setWithdrawOpen(true)}>
                  회원 탈퇴 신청
                </button>
              ) : (
                <>
                  <div className="fl-field">
                    <label className="fl-field-label" htmlFor="pf-wd-pw">
                      본인 확인을 위해 비밀번호를 입력하세요
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
                    <button
                      className="fl-btn"
                      onClick={() => {
                        setWithdrawOpen(false)
                        setWithdrawPassword('')
                        setWithdrawReason('')
                        setWithdrawError('')
                      }}
                    >
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
        </section>
      )}
    </div>
  )
}
