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

  // 열린 메뉴는 Esc로도 닫힌다 (바깥 탭은 백드롭이 받는다)
  useEffect(() => {
    if (!showMobileMenu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMobileMenu(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showMobileMenu])

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
      <span className="fl-userchip-name">{displayName}님</span>
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
            {/* 프로필은 메뉴를 열지 않고도 한 번에 가도록 막대에 아바타를 둔다 */}
            {authed && displayName && (
              <Link
                to="/profile"
                className="fl-avatar fl-avatar-link"
                aria-label={`${displayName}님 프로필`}
                title={`${displayName}님`}
                onClick={() => setShowMobileMenu(false)}
              >
                {displayName.charAt(0)}
              </Link>
            )}
            <button
              className="fl-btn-icon"
              onClick={() => setShowMobileMenu((v) => !v)}
              aria-label={showMobileMenu ? '메뉴 닫기' : '메뉴 열기'}
              aria-expanded={showMobileMenu}
              aria-controls="fl-mobile-nav"
            >
              {showMobileMenu ? '✕' : '☰'}
            </button>
          </>
        )}

        {/* 메뉴가 열리면 본문을 살짝 가리고, 가려진 곳을 탭하면 닫힌다 */}
        {isMobile && showMobileMenu && (
          <div className="fl-mobile-backdrop" onClick={() => setShowMobileMenu(false)} aria-hidden="true" />
        )}

        {isMobile && (
          <nav
            id="fl-mobile-nav"
            className={`fl-mobile-nav${showMobileMenu ? ' is-open' : ''}`}
            aria-hidden={!showMobileMenu}
            aria-label="주 메뉴"
          >
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={navClass}
                tabIndex={showMobileMenu ? undefined : -1}
                onClick={() => setShowMobileMenu(false)}
              >
                {link.label}
              </NavLink>
            ))}
            <div className="fl-mobile-nav-bottom">
              {themeButton}
              <div className="fl-mobile-nav-actions">
                {authed && userChip}
                {authed && (
                  <button className="fl-btn" onClick={handleLogout} tabIndex={showMobileMenu ? undefined : -1}>
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
