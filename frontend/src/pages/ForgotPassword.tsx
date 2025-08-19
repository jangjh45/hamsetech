import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(''); setError('')
    if (!username || !email || !newPassword || !confirm) { setError('모든 항목을 입력해 주세요.'); return }
    if (newPassword !== confirm) { setError('새 비밀번호가 일치하지 않습니다.'); return }
    try {
      await apiFetch('/api/auth/reset-by-identity', { method: 'POST', body: JSON.stringify({ username, email, newPassword }) })
      setMsg('비밀번호가 재설정되었습니다. 로그인해 주세요.')
      setTimeout(() => navigate('/login'), 1200)
    } catch (e: any) {
      setError(e.message || '요청 실패')
    }
  }

  return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center' }}>
      <div className="panel" style={{ maxWidth: 520, width: '100%', margin: '16px auto 32px' }}>
        <h1 className="title">비밀번호 찾기</h1>
        <form className="form" onSubmit={onSubmit}>
          <div className="field">
            <label className="label">아이디</label>
            <input className="input" placeholder="아이디" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">이메일</label>
            <input className="input" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">새 비밀번호</label>
            <input className="input" type="password" placeholder="새 비밀번호" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">새 비밀번호 확인</label>
            <input className="input" type="password" placeholder="새 비밀번호 확인" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button className="btn" type="submit">비밀번호 재설정</button>
          {msg && <p className="subtitle">{msg}</p>}
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </div>
  )
}


