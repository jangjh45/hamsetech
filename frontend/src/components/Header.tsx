import { Link, NavLink, useNavigate } from 'react-router-dom'
import { clearToken, getToken, onAuthChange, isAdmin, getDisplayName } from '../auth/token'
import { useEffect, useState } from 'react'
import useIsMobile from '../hooks/useIsMobile'
import useTheme from '../hooks/useTheme'

export default function Header() {
  const navigate = useNavigate()
  const [authed, setAuthed] = useState(!!getToken())
  const [admin, setAdmin] = useState(isAdmin())
  const [displayName, setDisplayName] = useState<string | null>(getDisplayName())
  const { theme, toggle: toggleTheme } = useTheme()
  const isMobile = useIsMobile()
  const [showMobileMenu, setShowMobileMenu] = useState<boolean>(false)

  useEffect(() => {
    const off = onAuthChange(() => {
      setAuthed(!!getToken())
      setAdmin(isAdmin())
      setDisplayName(getDisplayName())
    })
    return () => off()
  }, [])

  // 데스크톱으로 넓어지면 열려 있던 모바일 메뉴를 닫는다
  useEffect(() => {
    if (!isMobile) setShowMobileMenu(false)
  }, [isMobile])

  function handleLogout() {
    clearToken()
    navigate('/')
  }

  const navLinks = [
    { to: '/', label: '홈', end: true },
    { to: '/notices', label: '공지사항', end: false },
    { to: '/delivery', label: '적재 시뮬레이터', end: false },
    ...(authed ? [{ to: '/overtime', label: '잔업특근', end: false }] : []),
    ...(admin ? [{ to: '/admin', label: '관리자', end: false }] : []),
  ]

  const navClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'fl-nav-link is-active' : 'fl-nav-link'

  const themeButton = (
    <button className="fl-btn-icon" onClick={toggleTheme} title="테마 전환" aria-label="테마 전환">
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )

  const userChip = displayName ? (
    <Link to="/profile" className="fl-userchip" onClick={() => setShowMobileMenu(false)}>
      <span className="fl-avatar">{displayName.charAt(0)}</span>
      <span>{displayName}님</span>
    </Link>
  ) : null

  return (
    <header className="fl-header">
      <div className="fl-header-inner">
        <Link to="/" className="fl-brand" onClick={() => setShowMobileMenu(false)}>
          HamseTech
        </Link>

        {!isMobile && (
          <>
            <nav className="fl-nav">
              {navLinks.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.end} className={navClass}>
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <div className="fl-spacer" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {themeButton}
              {authed && userChip}
              {authed && (
                <button className="fl-btn" onClick={handleLogout}>
                  로그아웃
                </button>
              )}
            </div>
          </>
        )}

        {isMobile && (
          <>
            <div className="fl-spacer" />
            <button
              className="fl-btn-icon"
              onClick={() => setShowMobileMenu((v) => !v)}
              aria-label="메뉴"
              aria-expanded={showMobileMenu}
            >
              {showMobileMenu ? '✕' : '☰'}
            </button>
          </>
        )}

        {isMobile && showMobileMenu && (
          <nav
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              padding: '8px 0 12px',
              borderTop: '1px solid var(--fl-divider)',
            }}
          >
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={navClass}
                onClick={() => setShowMobileMenu(false)}
              >
                {link.label}
              </NavLink>
            ))}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                justifyContent: 'space-between',
                paddingTop: 10,
                marginTop: 6,
                borderTop: '1px solid var(--fl-divider)',
              }}
            >
              {themeButton}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {authed && userChip}
                {authed && (
                  <button className="fl-btn" onClick={handleLogout}>
                    로그아웃
                  </button>
                )}
              </div>
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
