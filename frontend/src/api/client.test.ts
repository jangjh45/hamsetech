import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { clearAuth, getAuthSnapshot, saveAuth } from '../auth/session'
import { apiFetch, apiFetchBlob, apiUpload, resetCsrfToken } from './client'
import { SERVER_ERROR_EVENT } from './serverErrorEvent'

let fetchMock: ReturnType<typeof vi.fn>
let apiHandler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })
}

function apiCalls() {
  return fetchMock.mock.calls.filter(([input]) => {
    return !String(input).includes('/api/auth/csrf')
  })
}

function lastApiInit(): RequestInit {
  return apiCalls().at(-1)?.[1] as RequestInit
}

function headerOf(name: string): string | null {
  return (lastApiInit().headers as Headers).get(name)
}

beforeEach(() => {
  clearAuth()
  resetCsrfToken()
  fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('/api/auth/csrf')) {
      return Promise.resolve(jsonResponse({ headerName: 'X-CSRF-TOKEN', token: 'csrf-test-token' }))
    }
    return apiHandler(input, init)
  })
  apiHandler = async () => jsonResponse({})
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('apiFetch — 세션 요청 구성', () => {
  it('JSON 응답을 파싱하고 쿠키 포함 요청을 보낸다', async () => {
    apiHandler = async () => jsonResponse({ id: 1 })
    await expect(apiFetch('/api/notices')).resolves.toEqual({ id: 1 })
    expect(apiCalls()[0][0]).toBe('/api/notices')
    expect((lastApiInit()).credentials).toBe('include')
  })

  it('JSON이 아니면 텍스트로 돌려준다', async () => {
    apiHandler = async () => textResponse('plain')
    await expect(apiFetch('/api/ping')).resolves.toBe('plain')
  })

  it('쓰기 요청에 Content-Type과 세션 CSRF 헤더를 붙인다', async () => {
    apiHandler = async () => jsonResponse({})
    await apiFetch('/api/todos', { method: 'POST', body: JSON.stringify({ title: 'x' }) })
    expect(headerOf('Content-Type')).toBe('application/json')
    expect(headerOf('X-CSRF-TOKEN')).toBe('csrf-test-token')
  })

  it('GET·HEAD에는 Content-Type과 CSRF 헤더를 붙이지 않는다', async () => {
    apiHandler = async () => jsonResponse({})
    await apiFetch('/api/todos')
    expect(headerOf('Content-Type')).toBeNull()
    expect(headerOf('X-CSRF-TOKEN')).toBeNull()
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/api/auth/csrf'))).toBe(false)
  })

  it('FormData에는 Content-Type을 붙이지 않는다', async () => {
    apiHandler = async () => jsonResponse({ id: 9 })
    const form = new FormData()
    form.append('file', new Blob(['x']), 'a.txt')
    await apiUpload('/api/notices/attachments', form)
    expect(headerOf('Content-Type')).toBeNull()
    expect(headerOf('X-CSRF-TOKEN')).toBe('csrf-test-token')
    expect(lastApiInit().body).toBe(form)
  })

  it('호출자가 지정한 Content-Type을 존중한다', async () => {
    apiHandler = async () => jsonResponse({})
    await apiFetch('/api/x', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'hi',
    })
    expect(headerOf('Content-Type')).toBe('text/plain')
  })
})

describe('apiFetch — 세션 만료와 권한 거부', () => {
  it('401은 로그인 화면으로 보내도록 인증 상태를 비운다', async () => {
    saveAuth(['USER'], 'kim')
    apiHandler = async () => jsonResponse({ error: 'unauthorized' }, 401)
    const listener = vi.fn()
    window.addEventListener('auth-expired', listener)
    try {
      await expect(apiFetch('/api/todos')).rejects.toThrow('로그인 세션이 만료')
      expect(getAuthSnapshot().status).toBe('anonymous')
      expect(listener).toHaveBeenCalledOnce()
    } finally {
      window.removeEventListener('auth-expired', listener)
    }
  })

  it('로그인 자격 증명 오류 401은 인증 상태 만료로 처리하지 않는다', async () => {
    apiHandler = async () => jsonResponse({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401)
    await expect(apiFetch('/api/auth/login', { method: 'POST', body: '{}' }))
      .rejects.toThrow('아이디 또는 비밀번호가 올바르지 않습니다.')
    expect(getAuthSnapshot().status).toBe('anonymous')
  })

  it('code=FORBIDDEN인 403은 권한 거부로 보고 로그인 상태를 유지한다', async () => {
    saveAuth(['USER'], 'kim')
    apiHandler = async () => jsonResponse({ code: 'FORBIDDEN', error: '권한이 없습니다.' }, 403)
    await expect(apiFetch('/api/admin/users')).rejects.toThrow('권한이 없습니다.')
    expect(getAuthSnapshot().status).toBe('authenticated')
  })

  it('세션 CSRF 토큰이 오래됐으면 갱신 후 안전하게 한 번 재시도한다', async () => {
    let writes = 0
    apiHandler = async () => {
      writes += 1
      return writes === 1
        ? jsonResponse({ code: 'CSRF_INVALID', error: 'stale' }, 403)
        : jsonResponse({ saved: true })
    }
    await expect(apiFetch('/api/todos', { method: 'POST', body: '{}' }))
      .resolves.toEqual({ saved: true })
    expect(writes).toBe(2)
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('/api/auth/csrf'))).toHaveLength(2)
  })
})

describe('apiFetch — 오류 응답', () => {
  it('서버의 error 필드를 쓴다', async () => {
    apiHandler = async () => jsonResponse({ error: '이미 사용 중인 값입니다.' }, 400)
    await expect(apiFetch('/api/todos', { method: 'POST', body: '{}' }))
      .rejects.toThrow('이미 사용 중인 값입니다.')
  })

  it('error가 없으면 message를 사용한다', async () => {
    apiHandler = async () => jsonResponse({ message: '다른 필드로 시도해 주세요.' }, 409)
    await expect(apiFetch('/api/x')).rejects.toThrow('다른 필드로 시도해 주세요.')
  })

  it('본문이 비어 있으면 HTTP 상태를 표시한다', async () => {
    apiHandler = async () => new Response(null, { status: 404 })
    await expect(apiFetch('/api/notices/999')).rejects.toThrow('HTTP 404')
  })

  it('5xx 응답이면 전역 서버 오류 이벤트를 발생시킨다', async () => {
    apiHandler = async () => textResponse('boom', 503)
    const listener: Mock<(event: Event) => void> = vi.fn()
    window.addEventListener(SERVER_ERROR_EVENT, listener)
    try {
      await expect(apiFetch('/api/x')).rejects.toThrow('boom')
      expect(listener).toHaveBeenCalledOnce()
      expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ kind: 'server', status: 503 })
    } finally {
      window.removeEventListener(SERVER_ERROR_EVENT, listener)
    }
  })
})

describe('apiFetchBlob / apiUpload', () => {
  it('바이너리를 Blob으로 돌려준다', async () => {
    apiHandler = async () => new Response(new TextEncoder().encode('xlsx-bytes'), {
      status: 200,
      headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    })
    const blob = await apiFetchBlob('/api/overtime-records/export')
    expect(blob.size).toBe('xlsx-bytes'.length)
    expect(blob.type).toContain('spreadsheetml')
    expect(await blob.text()).toBe('xlsx-bytes')
  })

  it('업로드는 POST와 CSRF 헤더로 FormData를 보낸다', async () => {
    apiHandler = async () => jsonResponse({ id: 3 })
    const form = new FormData()
    form.append('file', new Blob(['x']), 'a.png')
    await expect(apiUpload('/api/notices/attachments', form)).resolves.toEqual({ id: 3 })
    expect(lastApiInit().method).toBe('POST')
    expect(lastApiInit().body).toBe(form)
    expect(headerOf('X-CSRF-TOKEN')).toBe('csrf-test-token')
  })
})
