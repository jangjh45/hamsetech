import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api/client'
import AuthShell from '../components/AuthShell'
import PasswordStrength from '../components/PasswordStrength'

const STEPS = ['계정 정보', '프로필 정보'] as const

/*
 * 단계 표시. 막대만 있으면 1단계에서 이미 절반이, 2단계에서는 아직 신청도 안 했는데
 * 전부 찬 것처럼 읽히므로 각 칸에 이름과 번호를 붙이고 지난 단계는 체크로 구분한다.
 * current가 단계 수보다 크면(신청 완료 화면) 모든 칸이 완료로 표시된다.
 */
function Progress({ current }: { current: number }) {
  return (
    <ol className="au-steps" aria-label="회원가입 단계">
      {STEPS.map((label, i) => {
        const n = i + 1
        const state = n < current ? 'done' : n === current ? 'current' : 'todo'
        return (
          <li
            key={label}
            className={`au-step is-${state}`}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className="au-step-bar" />
            <span className="au-step-text">
              <span className="au-step-num" aria-hidden="true">
                {state === 'done' ? (
                  <svg viewBox="0 0 12 12" width="9" height="9" fill="none">
                    <path
                      d="M2.5 6.2 5 8.6l4.6-5.2"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  n
                )}
              </span>
              {label}
              {state === 'done' && <span className="au-sr">(완료)</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default function RegisterPage() {
  const [step, setStep] = useState<1 | 2>(1)
  const [submitted, setSubmitted] = useState('')
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
      // 가입은 신청까지다. 관리자가 승인해야 로그인할 수 있으므로 토큰이 오지 않는다.
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password, displayName }),
      })
      const { message } = (data ?? {}) as any
      setSubmitted(message || '가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.')
      setBusy(false)
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

  if (submitted) {
    return (
      <AuthShell>
        <Progress current={STEPS.length + 1} />

        <div className="au-heading">
          <h2>승인을 기다리는 중이에요</h2>
          <p>{submitted}</p>
        </div>

        {/* .fl-hint는 flex라 <b>가 따로 열로 떨어진다 — 문장 전체를 한 노드로 감싼다 */}
        <div className="fl-hint">
          <span>
            승인이 늦어지면 관리자에게 문의해 주세요. 승인 후에는 <b>{username}</b> 아이디로 바로
            로그인할 수 있습니다.
          </span>
        </div>

        <Link className="fl-btn fl-btn-primary au-submit" to="/login">
          로그인 화면으로
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <Progress current={step} />

      {/* key로 단계마다 새 노드를 만들어야 au-enter 등장 모션이 다시 돈다 */}
      <div className="au-heading" key={`h${step}`}>
        <h2>{step === 1 ? '계정 정보' : '프로필 정보'}</h2>
        <p>
          {step === 1
            ? '로그인에 쓸 아이디와 비밀번호를 정하세요.'
            : '동료에게 보일 이름과 연락받을 이메일이에요.'}
        </p>
      </div>

      {step === 1 ? (
        <form className="au-fields" key="step1" onSubmit={onNext}>
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
        <form className="au-fields" key="step2" onSubmit={onSubmit}>
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
            가입 후 관리자 승인이 필요합니다. 승인 전에는 로그인할 수 없어요.
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
              <span>{busy ? '신청하는 중…' : '가입 신청하기'}</span>
            </button>
          </div>
        </form>
      )}
    </AuthShell>
  )
}
