import { Link, useNavigate } from 'react-router-dom'
import { clearToken, getToken, onAuthChange, isAdmin, getDisplayName } from '../auth/token'
import { useEffect, useState } from 'react'

export default function Header() {
  const navigate = useNavigate()
  const [authed, setAuthed] = useState(!!getToken())
  const [admin, setAdmin] = useState(isAdmin())
  const [displayName, setDisplayName] = useState<string | null>(getDisplayName())
  const [theme, setTheme] = useState<string>(() => (localStorage.getItem('theme') || 'light'))
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768)
  const [showMobileMenu, setShowMobileMenu] = useState<boolean>(false)

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

  // 화면 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth >= 768) {
        setShowMobileMenu(false)
      }
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function handleLogout() {
    clearToken()
    navigate('/')
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
  }

  function toggleMobileMenu() {
    setShowMobileMenu(!showMobileMenu)
  }

  return (
    <div className="container">
      <nav className="navbar" style={{ 
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? 8 : 16
      }}>
        {/* 모바일 메뉴 헤더 */}
        {isMobile && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '8px 0'
          }}>
            <Link 
              to="/" 
              style={{ 
                fontWeight: 'bold', 
                fontSize: '18px',
                textDecoration: 'none',
                color: 'inherit'
              }}
              onClick={() => setShowMobileMenu(false)}
            >
              HamseTech
            </Link>
            <button 
              className="btn ghost" 
              onClick={toggleMobileMenu}
              style={{ padding: '8px 12px' }}
            >
              {showMobileMenu ? '✕' : '☰'}
            </button>
          </div>
        )}

        {/* 데스크톱 메뉴 */}
        {!isMobile && (
          <>
            <Link to="/">홈</Link>
            <Link to="/notices">공지사항</Link>
            <Link to="/delivery">적재 시뮬레이터</Link>
            {admin && <Link to="/admin">관리자</Link>}
            <div className="spacer" />
            <button className="btn ghost" onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
            {!authed && <Link to="/register">회원가입</Link>}
            {!authed && <Link to="/login">로그인</Link>}
            {authed && displayName && (<span className="subtitle" style={{ margin: 0 }}>{displayName}님</span>)}
            {authed && (<button className="btn ghost" onClick={handleLogout}>로그아웃</button>)}
          </>
        )}

        {/* 모바일 메뉴 */}
        {isMobile && showMobileMenu && (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 8,
            padding: '12px 0',
            borderTop: '1px solid var(--border)'
          }}>
            <Link to="/" onClick={() => setShowMobileMenu(false)}>홈</Link>
            <Link to="/notices" onClick={() => setShowMobileMenu(false)}>공지사항</Link>
            <Link to="/delivery" onClick={() => setShowMobileMenu(false)}>적재 시뮬레이터</Link>
            {admin && <Link to="/admin" onClick={() => setShowMobileMenu(false)}>관리자</Link>}
            {!authed && <Link to="/register" onClick={() => setShowMobileMenu(false)}>회원가입</Link>}
            {!authed && <Link to="/login" onClick={() => setShowMobileMenu(false)}>로그인</Link>}
            
            {/* 하단 옵션들을 한 줄로 */}
            <div style={{ 
              display: 'flex', 
              gap: 8,
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '8px',
              borderTop: '1px solid var(--border)'
            }}>
              <button className="btn ghost" onClick={toggleTheme} style={{ padding: '8px 12px' }}>{theme === 'dark' ? '☀️' : '🌙'}</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
                {authed && displayName && (<span className="subtitle" style={{ margin: 0, whiteSpace: 'nowrap' }}>{displayName}님</span>)}
                {authed && (<button className="btn ghost" onClick={handleLogout} style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>로그아웃</button>)}
              </div>
            </div>
          </div>
        )}
      </nav>
    </div>
  )
}

function applyTheme(mode: string) {
  const root = document.documentElement
  const theme = mode || 'light'
  root.setAttribute('data-theme', theme)
}


