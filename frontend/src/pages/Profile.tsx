import { useState, useEffect } from 'react'
import { apiFetch } from '../api/client'

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

  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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

  if (loading) return <div className="container" style={{ padding: 24, textAlign: 'center' }}>로딩 중...</div>

  return (
    <div className="container" style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      padding: isMobile ? '16px' : '24px' 
    }}>
      <div className="panel" style={{ 
        maxWidth: 600, 
        width: '100%', 
        margin: '0 auto' 
      }}>
        <h1 className="title" style={{ marginBottom: 24, textAlign: 'center' }}>내 프로필</h1>

        {/* 기본 정보 */}
        <section className="card" style={{ padding: 24, marginBottom: 24 }}>
          <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: '1.2rem', textAlign: 'left' }}>기본 정보</h2>
          
          <div style={{ marginBottom: 16 }}>
            <label className="field" style={{ textAlign: 'left' }}>아이디</label>
            <div className="input" style={{ backgroundColor: 'var(--bg)', color: 'var(--muted)' }}>
              {profile?.username}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="field" style={{ textAlign: 'left' }}>이메일</label>
            <div className="input" style={{ backgroundColor: 'var(--bg)', color: 'var(--muted)' }}>
              {profile?.email}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="field" style={{ textAlign: 'left' }}>권한</label>
            <div className="input" style={{ backgroundColor: 'var(--bg)', color: 'var(--muted)' }}>
              {profile?.roles.join(', ')}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="field" style={{ textAlign: 'left' }}>닉네임 (이름)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input 
                className="input" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={!isEditingName}
                style={{ flex: 1 }}
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

          {error && <p className="error">{error}</p>}
          {successMsg && <p style={{ color: 'var(--primary)', marginTop: 8 }}>{successMsg}</p>}
        </section>

        {/* 비밀번호 변경 */}
        <section className="card" style={{ padding: 24 }}>
          <h2 style={{ marginTop: 0, marginBottom: 20, fontSize: '1.2rem', textAlign: 'left' }}>비밀번호 변경</h2>
          
          <div style={{ marginBottom: 16 }}>
            <label className="field" style={{ textAlign: 'left' }}>현재 비밀번호</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type={showCurrentPassword ? "text" : "password"}
                className="input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="현재 비밀번호 입력"
                style={{ width: '100%', paddingRight: '45px' }}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '20px',
                  padding: '4px 8px',
                  opacity: 0.7,
                  transition: 'opacity 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                title={showCurrentPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                {showCurrentPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="field" style={{ textAlign: 'left' }}>새 비밀번호</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type={showNewPassword ? "text" : "password"}
                className="input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="8자 이상 입력"
                style={{ width: '100%', paddingRight: '45px' }}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '20px',
                  padding: '4px 8px',
                  opacity: 0.7,
                  transition: 'opacity 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                title={showNewPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                {showNewPassword ? '🙈' : '👁️'}
              </button>
            </div>
            
            {/* 비밀번호 강도 표시 */}
            {newPassword && (
              <div style={{ marginTop: 8 }}>
                <div style={{ 
                  display: 'flex', 
                  gap: 4, 
                  marginBottom: 4 
                }}>
                  {[1, 2, 3, 4].map((level) => {
                    const strength = getPasswordStrength(newPassword)
                    return (
                      <div
                        key={level}
                        style={{
                          flex: 1,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: level <= strength 
                            ? strength === 1 ? '#ef4444'
                            : strength === 2 ? '#f59e0b'
                            : strength === 3 ? '#3b82f6'
                            : '#10b981'
                            : 'var(--border)',
                          transition: 'background-color 0.3s'
                        }}
                      />
                    )
                  })}
                </div>
                <p style={{ 
                  fontSize: 12, 
                  margin: 0,
                  color: getPasswordStrength(newPassword) === 1 ? '#ef4444'
                    : getPasswordStrength(newPassword) === 2 ? '#f59e0b'
                    : getPasswordStrength(newPassword) === 3 ? '#3b82f6'
                    : '#10b981'
                }}>
                  {getPasswordStrength(newPassword) === 1 ? '약함'
                    : getPasswordStrength(newPassword) === 2 ? '보통'
                    : getPasswordStrength(newPassword) === 3 ? '강함'
                    : '매우 강함'}
                </p>
              </div>
            )}
            
            {/* 비밀번호 요구사항 */}
            {newPassword && newPassword.length < 8 && (
              <p style={{ fontSize: 12, color: '#ef4444', margin: '4px 0 0 0' }}>
                ⚠️ 최소 8자 이상 입력하세요
              </p>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="field" style={{ textAlign: 'left' }}>새 비밀번호 확인</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type={showConfirmPassword ? "text" : "password"}
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="새 비밀번호 다시 입력"
                style={{ width: '100%', paddingRight: '45px' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '20px',
                  padding: '4px 8px',
                  opacity: 0.7,
                  transition: 'opacity 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                title={showConfirmPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                {showConfirmPassword ? '🙈' : '👁️'}
              </button>
            </div>
            
            {/* 비밀번호 일치 여부 */}
            {confirmPassword && newPassword !== confirmPassword && (
              <p style={{ fontSize: 12, color: '#ef4444', margin: '4px 0 0 0' }}>
                ⚠️ 비밀번호가 일치하지 않습니다
              </p>
            )}
            {confirmPassword && newPassword === confirmPassword && newPassword.length >= 8 && (
              <p style={{ fontSize: 12, color: '#10b981', margin: '4px 0 0 0' }}>
                ✓ 비밀번호가 일치합니다
              </p>
            )}
          </div>

          <button 
            className="btn" 
            onClick={handleChangePassword}
            style={{ width: '100%' }}
            disabled={!currentPassword || !newPassword || !confirmPassword}
          >
            비밀번호 변경
          </button>

          {pwError && <p className="error" style={{ marginTop: 12 }}>{pwError}</p>}
          {pwSuccess && <p style={{ color: 'var(--primary)', marginTop: 12 }}>✓ {pwSuccess}</p>}
        </section>
      </div>
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
