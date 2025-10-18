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

// 토큰 만료 시 자동 로그아웃 처리
export function setupAutoLogout() {
  const handleTokenExpired = () => {
    console.log('토큰이 만료되어 자동 로그아웃됩니다.')
    clearToken()
    
    // 현재 페이지가 로그인 페이지가 아닌 경우에만 리다이렉트
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login'
    }
  }
  
  return onTokenExpired(handleTokenExpired)
}



