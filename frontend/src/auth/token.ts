export function saveToken(token: string) {
  localStorage.setItem('auth_token', token)
  window.dispatchEvent(new Event('auth-changed'))
}

export function saveAuth(token: string, roles: string[] = [], username?: string) {
  localStorage.setItem('auth_token', token)
  localStorage.setItem('auth_roles', JSON.stringify(roles))
  if (username) localStorage.setItem('auth_username', username)
  window.dispatchEvent(new Event('auth-changed'))
}

export function getToken(): string | null {
  return localStorage.getItem('auth_token')
}

export function getRoles(): string[] {
  try {
    const raw = localStorage.getItem('auth_roles')
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

export function isAdmin(): boolean {
  const roles = getRoles()
  return roles.includes('ADMIN') || roles.includes('SUPER_ADMIN')
}

export function getUsername(): string | null {
  return localStorage.getItem('auth_username')
}

export function saveDisplayName(name: string) {
  localStorage.setItem('auth_display_name', name)
  window.dispatchEvent(new Event('auth-changed'))
}

export function getDisplayName(): string | null {
  return localStorage.getItem('auth_display_name')
}

export function clearToken() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_roles')
  // 이름/아이디를 남겨두면 다음 사용자가 로그인할 때까지 헤더 칩에 옛 값이 붙는다
  localStorage.removeItem('auth_username')
  localStorage.removeItem('auth_display_name')
  window.dispatchEvent(new Event('auth-changed'))
}

export function onAuthChange(listener: () => void) {
  const handler = () => listener()
  window.addEventListener('auth-changed', handler)
  return () => window.removeEventListener('auth-changed', handler)
}

// 토큰 만료 이벤트 리스너
export function onTokenExpired(listener: () => void) {
  const handler = () => listener()
  window.addEventListener('token-expired', handler)
  return () => window.removeEventListener('token-expired', handler)
}

/** 만료 시점에 보던 위치. 로그인 후 복귀 목적지로 그대로 쓴다. */
export interface ExpiredFrom {
  pathname: string
  search: string
  hash: string
}

// 토큰 만료 시 자동 로그아웃 처리.
//
// 로그인 화면으로 보내는 일은 호출자(App)에게 맡긴다. 예전엔 여기서
// window.location.href로 페이지를 통째로 다시 띄웠는데, 그러면 라우터 state가
// 날아가 원래 보던 화면을 로그인 후 복귀 목적지로 넘길 수 없었다.
export function setupAutoLogout(redirectToLogin: (from: ExpiredFrom) => void) {
  const handleTokenExpired = () => {
    console.log('토큰이 만료되어 자동 로그아웃됩니다.')
    clearToken()

    if (typeof window === 'undefined') return
    const { pathname, search, hash } = window.location
    // 이미 로그인 화면이면 그대로 둔다. 여기서 다시 보내면 복귀 목적지가
    // /login으로 덮어써진다.
    if (pathname === '/login') return
    redirectToLogin({ pathname, search, hash })
  }

  return onTokenExpired(handleTokenExpired)
}



