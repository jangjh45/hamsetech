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

  if (loading) return <div className="fl-page">로딩 중...</div>

  const role = profile?.roles?.[0] ?? 'USER'
  const initial = (profile?.displayName || profile?.username || '?').charAt(0)
  const pwType = showPasswords ? 'text' : 'password'
  const pwToggleLabel = showPasswords ? '숨기기' : '보기'
  const match = confirmPassword.length > 0 && confirmPassword === newPassword
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword

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
    </div>
  )
}
