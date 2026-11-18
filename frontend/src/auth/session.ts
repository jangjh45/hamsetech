import { useSyncExternalStore } from 'react'

export interface SessionUser {
  username: string
  displayName: string
  avatarUrl: string | null
  roles: string[]
}

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'error'

export interface AuthSnapshot {
  status: AuthStatus
  user: SessionUser | null
}

let snapshot: AuthSnapshot = { status: 'loading', user: null }
const listeners = new Set<() => void>()

// Remove pre-session credentials left by an earlier JWT-based deployment.
if (typeof window !== 'undefined') {
  for (const key of ['auth_token', 'auth_roles', 'auth_username', 'auth_display_name', 'auth_avatar_url']) {
    window.localStorage.removeItem(key)
  }
}

function publish(next: AuthSnapshot) {
  snapshot = next
  listeners.forEach((listener) => listener())
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('auth-changed'))
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAuthSession(): AuthSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot)
}

export function getAuthSnapshot(): AuthSnapshot {
  return snapshot
}

export function setAuthLoading() {
  publish({ status: 'loading', user: null })
}

export function setAuthError() {
  publish({ status: 'error', user: null })
}

/** 로그인/세션 조회 응답으로 프론트 표시용 사용자 정보를 갱신한다. */
export function saveAuth(
  roles: string[] = [],
  username = '',
  displayName = '',
  avatarUrl: string | null = null,
) {
  publish({
    status: 'authenticated',
    user: { roles, username, displayName, avatarUrl },
  })
}

export function updateSessionRoles(roles: string[]) {
  if (snapshot.status !== 'authenticated' || !snapshot.user) return
  publish({ ...snapshot, user: { ...snapshot.user, roles } })
}

export function isAuthenticated(): boolean {
  return snapshot.status === 'authenticated'
}

export function isAdmin(): boolean {
  const roles = snapshot.user?.roles ?? []
  return roles.includes('ADMIN') || roles.includes('SUPER_ADMIN')
}

export function getRoles(): string[] {
  return snapshot.user?.roles ?? []
}

export function getUsername(): string | null {
  return snapshot.user?.username || null
}

export function saveDisplayName(name: string) {
  if (snapshot.status !== 'authenticated' || !snapshot.user) return
  publish({ ...snapshot, user: { ...snapshot.user, displayName: name } })
}

export function getDisplayName(): string | null {
  return snapshot.user?.displayName || null
}

export function saveAvatarUrl(url: string | null) {
  if (snapshot.status !== 'authenticated' || !snapshot.user) return
  publish({ ...snapshot, user: { ...snapshot.user, avatarUrl: url } })
}

export function getAvatarUrl(): string | null {
  return snapshot.user?.avatarUrl ?? null
}

export function clearAuth() {
  publish({ status: 'anonymous', user: null })
}

// 만료 시점에 보던 위치. 로그인 후 복귀 목적지로 그대로 쓴다.
export interface ExpiredFrom {
  pathname: string
  search: string
  hash: string
}

export function onAuthExpired(listener: () => void) {
  const handler = () => listener()
  window.addEventListener('auth-expired', handler)
  return () => window.removeEventListener('auth-expired', handler)
}

/** 서버 세션이 만료되면 앱 상태를 비우고 로그인 후 돌아올 위치를 보존한다. */
export function setupAutoLogout(redirectToLogin: (from: ExpiredFrom) => void) {
  const handleAuthExpired = () => {
    clearAuth()

    if (typeof window === 'undefined') return
    const { pathname, search, hash } = window.location
    if (pathname === '/login' || pathname === '/register' || pathname === '/forgot-password') return
    redirectToLogin({ pathname, search, hash })
  }

  return onAuthExpired(handleAuthExpired)
}
