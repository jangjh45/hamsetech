import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Path } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { saveAuth, saveDisplayName } from '../auth/token'
import AuthShell from '../components/AuthShell'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // 원래 목적지. 라우트 가드(ProtectedRoute/AdminRoute)는 location 객체를,
  // 토큰 만료 처리(App의 setupAutoLogout)는 pathname/search/hash만 넘기므로
  // 둘 다 받는 Partial<Path>로 읽는다. 역할과 무관하게 여기로 돌아가고,
  // 없으면 모두 메인 페이지로 들어온다.
  const from = (location.state as { from?: Partial<Path> } | null)?.from
  const redirectTo = from?.pathname && from.pathname !== '/login' ? from : '/'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      const { token, roles, username: uname, displayName } = data as any
      const roleList: string[] = roles ?? []
      saveAuth(token, roleList, uname)
      if (displayName) saveDisplayName(displayName)
      // replace로 이동해야 로그인 성공 후 뒤로 가기가 로그인 폼으로 돌아가지 않는다
      navigate(redirectTo, { replace: true })
    } catch (err: any) {
      // 로그인 실패 시 더 친화적인 오류 메시지 표시
      const errorMessage = err.message || '로그인에 실패했습니다.'
      if (errorMessage.includes('세션이 만료되었습니다')) {
        setError('로그인 세션이 만료되었습니다. 다시 로그인해주세요.')
      } else if (errorMessage.includes('아이디 또는 비밀번호가 올바르지 않습니다')) {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.')
      } else if (errorMessage.includes('Failed to execute')) {
        setError('로그인 중 오류가 발생했습니다. 다시 시도해주세요.')
      } else {
        setError(errorMessage)
      }
      setBusy(false)
    }
  }

  return (
    <AuthShell
      brandTitle={
        <>
          현장과 사무실이
          <br />
          같은 화면을 봅니다.
        </>
      }
      brandBody={
        <div className="au-points">
          <div className="au-point">적재 시뮬레이터로 차량 배치 미리 확인</div>
          <div className="au-point">잔업·특근 신청과 집계를 한 곳에서</div>
          <div className="au-point">공지사항·오늘 일정을 홈에서 바로</div>
        </div>
      }
    >
      <div className="au-heading">
        <p>사내 계정으로 로그인하세요.</p>
      </div>

      <form className="au-fields" onSubmit={onSubmit}>
        <div className="fl-field">
          <label className="fl-field-label" htmlFor="login-username">
            아이디
          </label>
          <input
            id="login-username"
            className="fl-input"
            placeholder="사번 또는 아이디"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="fl-field">
          <div className="fl-field-label">
            <label htmlFor="login-password">비밀번호</label>
            <Link className="au-forgot" to="/forgot-password">
              잊으셨나요?
            </Link>
          </div>
          <input
            id="login-password"
            className="fl-input"
            type="password"
            placeholder="비밀번호"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <div className="au-alert" role="alert">
            <span className="au-glyph">!</span>
            {error}
          </div>
        )}

        <button className="fl-btn fl-btn-primary au-submit" type="submit" disabled={busy}>
          {busy && <span className="au-spinner" />}
          <span>{busy ? '확인 중…' : '로그인'}</span>
        </button>

        <div className="au-alt">
          계정이 없나요?{' '}
          <Link className="fl-link" to="/register">
            회원가입
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}
