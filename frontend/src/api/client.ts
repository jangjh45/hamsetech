import { clearAuth, getAuthSnapshot } from '../auth/session'
import { SERVER_ERROR_EVENT, type ServerErrorDetail } from './serverErrorEvent'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface CsrfData {
  headerName: string
  token: string
}

let csrfData: CsrfData | null = null
let csrfRequest: Promise<CsrfData> | null = null

function dispatchAuthExpired() {
  window.dispatchEvent(new CustomEvent('auth-expired'))
}

function dispatchServerError(detail: ServerErrorDetail) {
  window.dispatchEvent(new CustomEvent<ServerErrorDetail>(SERVER_ERROR_EVENT, { detail }))
}

function resolveApiLocation(input: RequestInfo | URL) {
  let base = String(
    (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_BASE) || '',
  )
  if (!base && typeof window !== 'undefined' && window.location.port === '5173') {
    // Keep the same host for the development UI and API so their session cookie is shared.
    base = `${window.location.protocol}//${window.location.hostname}:8080`
  }
  base = base.replace(/\/$/, '')
  const url = typeof input === 'string' && input.startsWith('/') ? base + input : input
  const parsed = new URL(typeof url === 'string' ? url : url.toString(), window.location.href)
  return { base, url, pathname: parsed.pathname }
}

export function resetCsrfToken() {
  csrfData = null
  csrfRequest = null
}

async function getCsrfToken(base: string): Promise<CsrfData> {
  if (csrfData) return csrfData
  if (!csrfRequest) {
    csrfRequest = (async () => {
      let response: Response
      try {
        response = await fetch(`${base}/api/auth/csrf`, {
          method: 'GET',
          credentials: 'include',
          mode: 'cors' as RequestMode,
        })
      } catch (error) {
        dispatchServerError({ kind: 'network' })
        throw error
      }
      if (!response.ok) throw new ApiError('요청 보안 토큰을 가져오지 못했습니다.', response.status)
      csrfData = await response.json() as CsrfData
      return csrfData
    })().finally(() => {
      csrfRequest = null
    })
  }
  return csrfRequest
}

/**
 * Send a request with the session cookie. Unsafe methods first obtain a
 * session-bound CSRF token and retry once only when the server explicitly
 * reports that token as stale (the request was rejected before reaching a
 * controller).
 */
async function rawFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  retryCsrf = true,
): Promise<Response> {
  const { base, url, pathname } = resolveApiLocation(input)
  const authSnapshotAtRequest = getAuthSnapshot()
  const headers = new Headers(init.headers || {})
  const method = (init.method || 'GET').toUpperCase()
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = await getCsrfToken(base)
    headers.set(csrf.headerName, csrf.token)
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers,
      credentials: 'include',
      mode: 'cors' as RequestMode,
    })
  } catch (error) {
    if (!init.signal?.aborted) dispatchServerError({ kind: 'network' })
    throw error
  }

  if (response.ok) {
    if (pathname === '/api/auth/logout' || pathname === '/api/auth/change-password') resetCsrfToken()
    return response
  }

  const contentType = response.headers.get('Content-Type') || ''
  let bodyData: unknown
  if (contentType.includes('application/json')) {
    try {
      bodyData = await response.json()
    } catch {
      bodyData = await response.text()
    }
  } else {
    bodyData = await response.text()
  }

  if (response.status === 403 && typeof bodyData === 'object' && bodyData !== null
      && (bodyData as any).code === 'CSRF_INVALID' && retryCsrf) {
    resetCsrfToken()
    return rawFetch(input, init, false)
  }

  let message: string
  if (typeof bodyData === 'object' && bodyData !== null) {
    message = (bodyData as any).error || (bodyData as any).message || JSON.stringify(bodyData)
  } else {
    message = String(bodyData)
  }

  if (response.status === 403 && typeof bodyData === 'object' && bodyData !== null
      && (bodyData as any).code === 'FORBIDDEN') {
    const denied = (bodyData as any).error
    throw new Error(typeof denied === 'string' && denied ? denied : '권한이 없습니다.')
  }

  const isCredentialSubmission = pathname === '/api/auth/login' || pathname === '/api/auth/register'
  if (response.status === 401 && !isCredentialSubmission) {
    // Ignore a late unauthenticated bootstrap response if the user logged in
    // while that request was still in flight.
    if (pathname === '/api/users/me'
        && authSnapshotAtRequest.status === 'loading'
        && getAuthSnapshot().status === 'authenticated') {
      throw new ApiError(message || 'unauthorized', response.status)
    }
    clearAuth()
    resetCsrfToken()
    dispatchAuthExpired()
    throw new Error('로그인 세션이 만료되었습니다. 다시 로그인해 주세요.')
  }

  if (response.status >= 500) dispatchServerError({ kind: 'server', status: response.status })
  const error = new ApiError(message || `HTTP ${response.status}`, response.status)
  try {
    console.error('apiFetch error', { url, status: response.status, message })
  } catch {}
  throw error
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const response = await rawFetch(input, init)
  const contentType = response.headers.get('Content-Type') || ''
  if (contentType.includes('application/json')) return response.json()
  return response.text()
}

/** Binary downloads use the same session cookie and CSRF/error handling. */
export async function apiFetchBlob(input: RequestInfo | URL, init: RequestInit = {}): Promise<Blob> {
  const response = await rawFetch(input, init)
  return response.blob()
}

/** Multipart uploads leave Content-Type unset so the browser can add its boundary. */
export async function apiUpload<T>(input: RequestInfo | URL, form: FormData): Promise<T> {
  const response = await rawFetch(input, { method: 'POST', body: form })
  return response.json() as Promise<T>
}
