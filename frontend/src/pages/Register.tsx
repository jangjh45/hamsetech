import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { saveAuth, saveDisplayName } from '../auth/token'
import AuthShell from '../components/AuthShell'
import PasswordStrength from '../components/PasswordStrength'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // 1단계는 서버를 부르지 않는다. 가입 요청은 2단계 끝에 한 번만 나간다.
  function onNext(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim()) {
      setError('아이디를 입력해 주세요.')
      return
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    setError('')
    setStep(2)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password, displayName }),
      })
      const { token, roles, username: uname, displayName: dname } = data as any
      saveAuth(token, roles ?? [], uname)
      if (dname) saveDisplayName(dname)
      navigate('/')
    } catch (err: any) {
      setError(err.message || '회원가입에 실패했습니다.')
      setBusy(false)
    }
  }

  const alert = error && (
    <div className="au-alert" role="alert">
      <span className="au-glyph">!</span>
      {error}
    </div>
  )

  return (
    <AuthShell
      brandTitle={
        <>
          2분이면
          <br />
          계정이 만들어집니다.
        </>
      }
      brandBody={
        <div className="au-steps">
          <div className={step === 1 ? 'au-step is-active' : 'au-step'}>
            <span className="au-step-num">1</span>
            <div>
              <div className="au-step-name">계정 정보</div>
              <div className="au-step-sub">아이디와 비밀번호</div>
            </div>
          </div>
          <div className={step === 2 ? 'au-step is-active' : 'au-step'}>
            <span className="au-step-num">2</span>
            <div>
              <div className="au-step-name">프로필</div>
              <div className="au-step-sub">이메일과 표시 이름</div>
            </div>
          </div>
        </div>
      }
    >
      <div className="au-progress">
        <span className="au-progress-bar is-on" />
        <span className={step === 2 ? 'au-progress-bar is-on' : 'au-progress-bar'} />
        <span className="au-progress-label">{step}/2</span>
      </div>

      <div className="au-heading">
        <h2>{step === 1 ? '계정 정보' : '프로필 정보'}</h2>
        <p>
          {step === 1
            ? '로그인에 쓸 아이디와 비밀번호를 정하세요.'
            : '동료에게 보일 이름과 연락받을 이메일이에요.'}
        </p>
      </div>

      {step === 1 ? (
        <form className="au-fields" onSubmit={onNext}>
          <div className="fl-field">
            <label className="fl-field-label" htmlFor="reg-username">
              아이디
            </label>
            <input
              id="reg-username"
              className="fl-input"
              placeholder="사번 또는 아이디"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="fl-field">
            <label className="fl-field-label" htmlFor="reg-password">
              비밀번호
            </label>
            <input
              id="reg-password"
              className="fl-input"
              type="password"
              placeholder="8자 이상, 숫자와 기호 포함"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PasswordStrength password={password} />
          </div>

          {alert}

          <button className="fl-btn fl-btn-primary au-submit" type="submit">
            다음
          </button>

          <div className="au-alt">
            이미 계정이 있나요?{' '}
            <Link className="fl-link" to="/login">
              로그인
            </Link>
          </div>
        </form>
      ) : (
        <form className="au-fields" onSubmit={onSubmit}>
          <div className="fl-field">
            <label className="fl-field-label" htmlFor="reg-email">
              이메일
            </label>
            <input
              id="reg-email"
              className="fl-input"
              type="email"
              placeholder="name@hamsetech.co.kr"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="fl-field">
            <label className="fl-field-label" htmlFor="reg-displayname">
              이름 또는 닉네임
            </label>
            <input
              id="reg-displayname"
              className="fl-input"
              placeholder="동료에게 보이는 이름"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="fl-hint">
            가입 후 관리자 승인이 필요합니다. 승인 전에도 공지사항은 볼 수 있어요.
          </div>

          {alert}

          <div className="au-actions">
            <button
              className="fl-btn"
              type="button"
              onClick={() => {
                setError('')
                setStep(1)
              }}
            >
              이전
            </button>
            <button className="fl-btn fl-btn-primary au-submit" type="submit" disabled={busy}>
              {busy && <span className="au-spinner" />}
              <span>{busy ? '계정 만드는 중…' : '가입 완료하기'}</span>
            </button>
          </div>
        </form>
      )}
    </AuthShell>
  )
}
