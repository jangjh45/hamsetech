import { getToken, clearToken } from '../auth/token'

// 토큰 만료 이벤트 발생 함수
function dispatchTokenExpired() {
  window.dispatchEvent(new CustomEvent('token-expired'))
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  let base = (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_BASE) || ''
  if (!base && typeof window !== 'undefined') {
    if (window.location.host.includes('localhost:5173') || window.location.host.includes('127.0.0.1:5173')) {
      base = 'http://localhost:8080'
    }
  }
  const url = (typeof input === 'string' && input.startsWith('/')) ? (base + input) : input
  const token = getToken()
  const headers = new Headers(init.headers || {})
  const method = (init.method || 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(url, { ...init, headers, credentials: 'include', mode: 'cors' as RequestMode })
  
  // 응답 본문을 한 번만 읽기 위한 함수
  const readResponseBody = async () => {
    const contentType = res.headers.get('Content-Type') || ''
    if (contentType.includes('application/json')) {
      try {
        return await res.json()
      } catch {
        return await res.text()
      }
    } else {
      return await res.text()
    }
  }
  
  // 토큰 만료 감지 (401 Unauthorized 또는 403 Forbidden)
  if (!res.ok && (res.status === 401 || res.status === 403)) {
    const bodyData = await readResponseBody()
    let message = ''
    
    if (typeof bodyData === 'object' && bodyData !== null) {
      message = (bodyData as any).error || (bodyData as any).message || ''
      if (!message) message = JSON.stringify(bodyData)
    } else {
      message = String(bodyData)
    }
    
    // 토큰이 있는 경우 만료로 간주하고 자동 로그아웃 처리
    if (token) {
      console.warn('토큰이 만료되었습니다. 자동 로그아웃 처리합니다.', { url, status: res.status, message })
      clearToken()
      dispatchTokenExpired()
      
      // 로그인 페이지로 리다이렉트 (현재 페이지가 로그인 페이지가 아닌 경우에만)
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
      
      throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.')
    }
    
    // 토큰이 없는 경우 일반 오류로 처리
    const err = new Error(message || `HTTP ${res.status}`)
    try { console.error('apiFetch error', { url, status: res.status, message }) } catch {}
    throw err
  }
  
  if (!res.ok) {
    const bodyData = await readResponseBody()
    let message = ''
    
    if (typeof bodyData === 'object' && bodyData !== null) {
      message = (bodyData as any).error || (bodyData as any).message || ''
      if (!message) message = JSON.stringify(bodyData)
    } else {
      message = String(bodyData)
    }
    
    const err = new Error(message || `HTTP ${res.status}`)
    try { console.error('apiFetch error', { url, status: res.status, message }) } catch {}
    throw err
  }
  
  // 성공 응답 처리
  const contentType = res.headers.get('Content-Type') || ''
  if (contentType.includes('application/json')) return res.json()
  return res.text()
}


