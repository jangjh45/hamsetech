import { getToken } from '../auth/token'

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
  if (!res.ok) {
    const contentType = res.headers.get('Content-Type') || ''
    let message = ''
    if (contentType.includes('application/json')) {
      try {
        const data = await res.json()
        message = (data && (data.error || data.message)) || ''
        if (!message) message = JSON.stringify(data)
      } catch {
        message = await res.text()
      }
    } else {
      message = await res.text()
    }
    const err = new Error(message || `HTTP ${res.status}`)
    try { console.error('apiFetch error', { url, status: res.status, message }) } catch {}
    throw err
  }
  const contentType = res.headers.get('Content-Type') || ''
  if (contentType.includes('application/json')) return res.json()
  return res.text()
}


