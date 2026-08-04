import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import useTheme from '../hooks/useTheme'
import '../styles/auth.css'

interface AuthShellProps {
  /** 왼쪽 브랜드 면의 큰 문구. 줄바꿈은 <br />로 직접 넣는다. */
  brandTitle: ReactNode
  /** 큰 문구 아래 내용 — 로그인은 불릿 3개, 회원가입은 단계 목록. */
  brandBody: ReactNode
  /** 오른쪽 폼. */
  children: ReactNode
}

// 로그인 · 회원가입 · 비밀번호 찾기가 공유하는 좌우 2단 셸.
// 이 세 화면에서는 App이 전역 Header를 렌더하지 않으므로 테마 토글을
// 오른쪽 위에 따로 둔다.
export default function AuthShell({ brandTitle, brandBody, children }: AuthShellProps) {
  const { theme, toggle } = useTheme()

  return (
    <div className="au-shell">
      <div className="au-brand">
        <div className="au-brand-layers" aria-hidden="true">
          <span className="au-glow-a" />
          <span className="au-glow-b" />
          <span className="au-grid" />
          <span className="au-sweep" />
        </div>
        <Link to="/" className="au-brand-mark">
          HamseTech
        </Link>
        <div className="au-brand-main">
          <h1 className="au-brand-title">{brandTitle}</h1>
          {brandBody}
        </div>
        <div className="au-brand-foot">© {new Date().getFullYear()} HamseTech</div>
      </div>

      <div className="au-form">
        <button
          className="fl-btn-icon au-theme"
          onClick={toggle}
          title="테마 전환"
          aria-label="테마 전환"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <div className="au-form-inner">{children}</div>
      </div>
    </div>
  )
}
