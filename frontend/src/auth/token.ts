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



