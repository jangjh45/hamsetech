import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import useTheme from '../hooks/useTheme'
import '../styles/auth.css'

interface AuthShellProps {
  /** 폼 카드 안에 들어갈 내용. */
  children: ReactNode
}

/*
 * 로그인 · 회원가입 · 비밀번호 찾기가 공유하는 셸.
 *
 * 어두운 면 위로 크게 번진 빛덩이 세 개가 아주 느리게 서로 겹치며 흐른다(오로라).
 * 가장자리가 없는 배경이라 어디서 멈춰도 어색한 지점이 생기지 않는다. 폼은 배경이
 * 비쳐 보이는 유리 카드로 화면 한가운데에 뜬다. 브랜드 문구는 두지 않고 로고와
 * 폼만 남긴다. 이 세 화면에서는 App이 전역 Header를 렌더하지 않으므로 테마 토글을
 * 오른쪽 위에 따로 둔다.
 */
export default function AuthShell({ children }: AuthShellProps) {
  const { theme, toggle } = useTheme()

  return (
    <div className="au-shell">
      <div className="au-stage" aria-hidden="true">
        <span className="au-aurora au-aurora-a" />
        <span className="au-aurora au-aurora-b" />
        <span className="au-aurora au-aurora-c" />
      </div>

      <Link to="/" className="au-brand-mark">
        HamseTech
      </Link>

      <button
        className="fl-btn-icon au-theme"
        onClick={toggle}
        title="테마 전환"
        aria-label="테마 전환"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <div className="au-pane">
        <div className="au-card">{children}</div>
      </div>

      <div className="au-foot">© {new Date().getFullYear()} HamseTech</div>
    </div>
  )
}
