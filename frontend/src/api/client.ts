import { getToken, clearToken } from '../auth/token'

// 토큰 만료 이벤트 발생 함수
function dispatchTokenExpired() {
  window.dispatchEvent(new CustomEvent('token-expired'))
}

/**
 * 요청을 보내고 응답 본문은 건드리지 않은 채 Response를 돌려준다.
 * 실패 응답(401/403 자동 로그아웃 포함)은 여기서 전부 처리하고 예외로 던지므로,
 * 호출자는 성공 응답을 원하는 형태(json/text/blob)로만 읽으면 된다.
 */
async function rawFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
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
  // FormData는 브라우저가 boundary를 포함한 Content-Type을 직접 붙인다.
  // 여기서 application/json으로 덮어쓰면 boundary가 사라져 서버가 본문을 파싱하지 못한다.
  // 호출자가 직접 지정한 Content-Type도 존중한다.
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData
  if (method !== 'GET' && method !== 'HEAD' && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(url, { ...init, headers, credentials: 'include', mode: 'cors' as RequestMode })

  if (res.ok) return res

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

  const bodyData = await readResponseBody()
  let message = ''

  if (typeof bodyData === 'object' && bodyData !== null) {
    message = (bodyData as any).error || (bodyData as any).message || ''
    if (!message) message = JSON.stringify(bodyData)
  } else {
    message = String(bodyData)
  }

  // 토큰 만료 감지 (401 Unauthorized 또는 403 Forbidden)
  // 만료된 토큰은 필터에서 걸러져 익명 요청이 되고, Spring은 그때 401이 아니라 403을 준다.
  // 그래서 403도 만료로 취급해야 하는데, "남의 항목이라 안 됨"도 같은 403이라
  // 그대로 두면 정상 로그인 사용자가 권한 거부 한 번에 로그아웃된다.
  // 서버가 code: FORBIDDEN을 붙인 응답은 만료가 아닌 권한 거부로 구분한다.
  if (res.status === 401 || res.status === 403) {
    const isPermissionDenied =
      typeof bodyData === 'object' && bodyData !== null && (bodyData as any).code === 'FORBIDDEN'

    if (isPermissionDenied) {
      const err = new Error(message || '권한이 없습니다.')
      try { console.warn('apiFetch forbidden', { url, status: res.status, message }) } catch {}
      throw err
    }

    // 토큰이 있는 경우 만료로 간주하고 자동 로그아웃 처리
    if (token) {
      console.warn('토큰이 만료되었습니다. 자동 로그아웃 처리합니다.', { url, status: res.status, message })
      clearToken()
      // 로그인 화면으로 보내는 건 이 이벤트를 받는 App의 setupAutoLogout이 맡는다.
      // 여기서 window.location.href로 직접 보내면 페이지가 통째로 다시 떠서
      // 원래 보던 화면을 로그인 후 복귀 목적지로 넘길 수 없다.
      dispatchTokenExpired()

      throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.')
    }
  }

  const err = new Error(message || `HTTP ${res.status}`)
  try { console.error('apiFetch error', { url, status: res.status, message }) } catch {}
  throw err
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const res = await rawFetch(input, init)

  // 성공 응답 처리
  const contentType = res.headers.get('Content-Type') || ''
  if (contentType.includes('application/json')) return res.json()
  return res.text()
}

/**
 * 파일 다운로드용. 엑셀 같은 바이너리 응답은 apiFetch로 받으면 text()로 읽혀 파일이 깨진다.
 * 토큰이 쿠키가 아니라 localStorage에 있어 <a href> 직접 링크로는 받을 수 없다.
 */
export async function apiFetchBlob(input: RequestInfo | URL, init: RequestInit = {}): Promise<Blob> {
  const res = await rawFetch(input, init)
  return res.blob()
}

/**
 * multipart 업로드용.
 *
 * Content-Type을 절대 지정하지 않는다. boundary는 브라우저만 알고 있어서,
 * 직접 헤더를 쓰는 순간 서버가 본문을 읽지 못한다.
 */
export async function apiUpload<T>(input: RequestInfo | URL, form: FormData): Promise<T> {
  const res = await rawFetch(input, { method: 'POST', body: form })
  return res.json() as Promise<T>
}
