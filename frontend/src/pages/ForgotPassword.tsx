import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import AuthShell from '../components/AuthShell'
import PasswordStrength from '../components/PasswordStrength'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(''); setError('')
    if (!username || !email || !newPassword || !confirm) { setError('모든 항목을 입력해 주세요.'); return }
    if (newPassword !== confirm) { setError('새 비밀번호가 일치하지 않습니다.'); return }
    setBusy(true)
    try {
      await apiFetch('/api/auth/reset-by-identity', { method: 'POST', body: JSON.stringify({ username, email, newPassword }) })
      setMsg('비밀번호가 재설정되었습니다. 로그인해 주세요.')
      setTimeout(() => navigate('/login'), 1200)
    } catch (e: any) {
      setError(e.message || '요청 실패')
      setBusy(false)
    }
  }

  return (
    <AuthShell
      brandTitle={
        <>
          비밀번호는
          <br />
          바로 다시 정할 수 있어요.
        </>
      }
      brandBody={
        <div className="au-points">
          <div className="au-point">가입할 때 쓴 아이디와 이메일로 본인 확인</div>
          <div className="au-point">관리자 승인을 기다리지 않아도 됩니다</div>
          <div className="au-point">재설정하면 바로 로그인 화면으로</div>
        </div>
      }
    >
      <div className="au-heading">
        <h2>비밀번호 재설정</h2>
        <p>아이디와 가입 이메일이 일치하면 바로 바꿀 수 있습니다.</p>
      </div>

      <form className="au-fields" onSubmit={onSubmit}>
        <div className="fl-field">
          <label className="fl-field-label" htmlFor="fp-username">
            아이디
          </label>
          <input
            id="fp-username"
            className="fl-input"
            placeholder="사번 또는 아이디"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="fl-field">
          <label className="fl-field-label" htmlFor="fp-email">
            이메일
          </label>
          <input
            id="fp-email"
            className="fl-input"
            type="email"
            placeholder="가입할 때 쓴 이메일"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="fl-field">
          <label className="fl-field-label" htmlFor="fp-new">
            새 비밀번호
          </label>
          <input
            id="fp-new"
            className="fl-input"
            type="password"
            placeholder="8자 이상"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <PasswordStrength password={newPassword} />
        </div>

        <div className="fl-field">
          <label className="fl-field-label" htmlFor="fp-confirm">
            새 비밀번호 확인
          </label>
          <input
            id="fp-confirm"
            className="fl-input"
            type="password"
            placeholder="한 번 더 입력"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {error && (
          <div className="au-alert" role="alert">
            <span className="au-glyph">!</span>
            {error}
          </div>
        )}
        {msg && (
          <div className="au-alert is-ok" role="status">
            <span className="au-glyph">✓</span>
            {msg}
          </div>
        )}

        <button className="fl-btn fl-btn-primary au-submit" type="submit" disabled={busy}>
          {busy && <span className="au-spinner" />}
          <span>{busy ? '재설정 중…' : '비밀번호 재설정'}</span>
        </button>

        <div className="au-alt">
          <Link className="fl-link" to="/login">
            로그인으로 돌아가기
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}
