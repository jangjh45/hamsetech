import { useState, useEffect } from 'react'
import { apiFetch } from '../api/client'
import '../styles/profile.css'

interface UserProfile {
  username: string
  email: string
  displayName: string
  roles: string[]
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  
  // Edit Display Name state
  const [displayName, setDisplayName] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    loadProfile()
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

  async function handleUpdateProfile() {
    try {
      setError('')
      setSuccessMsg('')
      const res = await apiFetch('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify({ displayName })
      })
      setProfile(res as UserProfile)
      setSuccessMsg('프로필이 업데이트되었습니다.')
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

  if (loading) return <div className="container center">로딩 중...</div>

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1 className="profile-title">내 프로필</h1>
      </div>

      {/* 기본 정보 */}
      <section className="profile-card">
        <div className="profile-section-header">
          <h2 className="profile-section-title">기본 정보</h2>
        </div>
        
        <div className="profile-form-group">
          <label className="profile-label">아이디</label>
          <div className="profile-value">
            {profile?.username}
          </div>
        </div>

        <div className="profile-form-group">
          <label className="profile-label">이메일</label>
          <div className="profile-value">
            {profile?.email}
          </div>
        </div>

        <div className="profile-form-group">
          <label className="profile-label">권한</label>
          <div className="profile-value">
            {profile?.roles.join(', ')}
          </div>
        </div>

        <div className="profile-form-group">
          <label className="profile-label">닉네임 (이름)</label>
          <div className="profile-input-with-button">
            <input 
              className="profile-input" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={!isEditingName}
            />
            {isEditingName ? (
              <>
                <button className="btn" onClick={handleUpdateProfile}>저장</button>
                <button className="btn ghost" onClick={() => {
                  setIsEditingName(false)
                  setDisplayName(profile?.displayName || '')
                  setError('')
                }}>취소</button>
              </>
            ) : (
              <button className="btn ghost" onClick={() => setIsEditingName(true)}>수정</button>
            )}
          </div>
        </div>

        {error && <div className="validation-message error">⚠️ {error}</div>}
        {successMsg && <div className="validation-message success">✓ {successMsg}</div>}
      </section>

      {/* 비밀번호 변경 */}
      <section className="profile-card">
        <div className="profile-section-header">
          <h2 className="profile-section-title">비밀번호 변경</h2>
        </div>
        
        <div className="profile-form-group">
          <label className="profile-label">현재 비밀번호</label>
          <div className="profile-input-wrapper">
            <input 
              type={showCurrentPassword ? "text" : "password"}
              className="profile-input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="현재 비밀번호 입력"
              style={{ paddingRight: '45px' }}
            />
            <button
              type="button"
              className="profile-password-toggle"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              title={showCurrentPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            >
              {showCurrentPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <div className="profile-form-group">
          <label className="profile-label">새 비밀번호</label>
          <div className="profile-input-wrapper">
            <input 
              type={showNewPassword ? "text" : "password"}
              className="profile-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="8자 이상 입력"
              style={{ paddingRight: '45px' }}
            />
            <button
              type="button"
              className="profile-password-toggle"
              onClick={() => setShowNewPassword(!showNewPassword)}
              title={showNewPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            >
              {showNewPassword ? '🙈' : '👁️'}
            </button>
          </div>
          
          {/* 비밀번호 강도 표시 */}
          {newPassword && (
            <div className="password-strength-container">
              <div className="strength-bars">
                {[1, 2, 3, 4].map((level) => {
                  const strength = getPasswordStrength(newPassword)
                  return (
                    <div
                      key={level}
                      className="strength-bar"
                      style={{
                        backgroundColor: level <= strength 
                          ? (strength === 1 ? '#ef4444' : strength === 2 ? '#f59e0b' : strength === 3 ? '#3b82f6' : '#10b981') 
                          : 'var(--border)'
                      }}
                    />
                  )
                })}
              </div>
              <p className={`strength-text ${
                getPasswordStrength(newPassword) === 1 ? 'strength-weak'
                : getPasswordStrength(newPassword) === 2 ? 'strength-fair'
                : getPasswordStrength(newPassword) === 3 ? 'strength-good'
                : 'strength-strong'
              }`}>
                {getPasswordStrength(newPassword) === 1 ? '약함'
                  : getPasswordStrength(newPassword) === 2 ? '보통'
                  : getPasswordStrength(newPassword) === 3 ? '강함'
                  : '매우 강함'}
              </p>
            </div>
          )}
          
          {/* 비밀번호 요구사항 */}
          {newPassword && newPassword.length < 8 && (
            <div className="validation-message error">
              ⚠️ 최소 8자 이상 입력하세요
            </div>
          )}
        </div>

        <div className="profile-form-group">
          <label className="profile-label">새 비밀번호 확인</label>
          <div className="profile-input-wrapper">
            <input 
              type={showConfirmPassword ? "text" : "password"}
              className="profile-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="새 비밀번호 다시 입력"
              style={{ paddingRight: '45px' }}
            />
            <button
              type="button"
              className="profile-password-toggle"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              title={showConfirmPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            >
              {showConfirmPassword ? '🙈' : '👁️'}
            </button>
          </div>
          
          {/* 비밀번호 일치 여부 */}
          {confirmPassword && newPassword !== confirmPassword && (
            <div className="validation-message error">
              ⚠️ 비밀번호가 일치하지 않습니다
            </div>
          )}
          {confirmPassword && newPassword === confirmPassword && newPassword.length >= 8 && (
            <div className="validation-message success">
              ✓ 비밀번호가 일치합니다
            </div>
          )}
        </div>

        <button 
          className="btn profile-btn-primary" 
          onClick={handleChangePassword}
          disabled={!currentPassword || !newPassword || !confirmPassword}
        >
          비밀번호 변경
        </button>

        {pwError && <div className="validation-message error">⚠️ {pwError}</div>}
        {pwSuccess && <div className="validation-message success">✓ {pwSuccess}</div>}
      </section>
    </div>
  )
}

// 비밀번호 강도 계산 (1: 약함, 2: 보통, 3: 강함, 4: 매우 강함)
function getPasswordStrength(password: string): number {
  let strength = 0
  
  if (password.length >= 8) strength++
  if (password.length >= 12) strength++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
  if (/[0-9]/.test(password)) strength++
  if (/[^a-zA-Z0-9]/.test(password)) strength++
  
  return Math.min(strength, 4)
}
