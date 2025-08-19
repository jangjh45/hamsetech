import { Link, useNavigate } from 'react-router-dom'
import { clearToken, getToken, onAuthChange, isAdmin, getDisplayName } from '../auth/token'
import { useEffect, useState } from 'react'

export default function Header() {
  const navigate = useNavigate()
  const [authed, setAuthed] = useState(!!getToken())
  const [admin, setAdmin] = useState(isAdmin())
  const [displayName, setDisplayName] = useState<string | null>(getDisplayName())
  const [theme, setTheme] = useState<string>(() => (localStorage.getItem('theme') || prefersDark() ? 'dark' : 'light'))

  useEffect(() => {
    const off = onAuthChange(() => {
      setAuthed(!!getToken())
      setAdmin(isAdmin())
      setDisplayName(getDisplayName())
    })
    return () => off()
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  function handleLogout() {
    clearToken()
    navigate('/')
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
  }

  return (
    <div className="container">
      <nav className="navbar">
        <Link to="/">홈</Link>
        <Link to="/notices">공지사항</Link>
        {admin && <Link to="/admin">관리자</Link>}
        <div className="spacer" />
        <button className="btn ghost" onClick={toggleTheme}>{theme === 'dark' ? '라이트 모드' : '다크 모드'}</button>
        {!authed && <Link to="/register">회원가입</Link>}
        {!authed && <Link to="/login">로그인</Link>}
        {authed && displayName && (<span className="subtitle" style={{ margin: 0 }}>{displayName}님</span>)}
        {authed && (<button className="btn ghost" onClick={handleLogout}>로그아웃</button>)}
      </nav>
    </div>
  )
}

function prefersDark() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(mode: string) {
  const root = document.documentElement
  const theme = mode || (prefersDark() ? 'dark' : 'light')
  root.setAttribute('data-theme', theme)
}


