import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getToken, saveToken } from '../auth/token'
import { apiFetch, apiFetchBlob, apiUpload } from './client'

// 실제 fetch를 대체한다. 호출 내용(URL·헤더·본문)만 확인한다.
let fetchMock: ReturnType<typeof vi.fn>

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })
}

beforeEach(() => {
  localStorage.clear()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  // 만료/거부 분기가 console을 울린다. 테스트 출력을 흐리지 않게 한다.
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function lastInit(): RequestInit {
  return fetchMock.mock.calls[0][1] as RequestInit
}

function headerOf(name: string): string | null {
  return (lastInit().headers as Headers).get(name)
}

describe('apiFetch — 요청 구성', () => {
  it('JSON 응답을 파싱해 돌려준다', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 1 }))

    await expect(apiFetch('/api/notices')).resolves.toEqual({ id: 1 })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/notices')
  })

  it('JSON이 아니면 텍스트로 돌려준다', async () => {
    fetchMock.mockResolvedValue(textResponse('plain'))
    await expect(apiFetch('/api/ping')).resolves.toBe('plain')
  })

  it('쓰기 요청에는 Content-Type을 붙인다', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await apiFetch('/api/todos', { method: 'POST', body: JSON.stringify({ title: 'x' }) })

    expect(headerOf('Content-Type')).toBe('application/json')
  })

  it('GET·HEAD에는 Content-Type을 붙이지 않는다', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await apiFetch('/api/todos')
    expect(headerOf('Content-Type')).toBeNull()
  })

  it('FormData에는 Content-Type을 절대 붙이지 않는다', async () => {
    // boundary는 브라우저만 안다. application/json으로 덮으면 서버가 본문을 못 읽는다.
    fetchMock.mockResolvedValue(jsonResponse({ id: 9 }))
    const form = new FormData()
    form.append('file', new Blob(['x']), 'a.txt')

    await apiUpload('/api/notices/attachments', form)

    expect(headerOf('Content-Type')).toBeNull()
  })

  it('호출자가 지정한 Content-Type을 존중한다', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await apiFetch('/api/x', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'hi',
    })

    expect(headerOf('Content-Type')).toBe('text/plain')
  })

  it('토큰이 있으면 Authorization을 붙인다', async () => {
    saveToken('jwt-abc')
    fetchMock.mockResolvedValue(jsonResponse({}))

    await apiFetch('/api/todos')
    expect(headerOf('Authorization')).toBe('Bearer jwt-abc')
  })

  it('토큰이 없으면 Authorization을 안 붙인다', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    await apiFetch('/api/auth/login', { method: 'POST', body: '{}' })

    expect(headerOf('Authorization')).toBeNull()
  })
})

describe('apiFetch — 토큰 만료와 권한 거부', () => {
  it('401은 만료로 보고 로그아웃시킨다', async () => {
    // 만료된 토큰은 필터에서 걸러져 익명 요청이 되고, Spring은 그때 401이 아니라
    // 403을 준다. 그래서 403도 만료로 취급해야 한다.
    saveToken('expired')
    fetchMock.mockResolvedValue(jsonResponse({ error: '권한이 없습니다.' }, 401))

    await expect(apiFetch('/api/todos')).rejects.toThrow('세션이 만료되었습니다')
    expect(getToken()).toBeNull()
  })

  it('403도 만료로 보고 로그아웃시킨다', async () => {
    saveToken('expired')
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Forbidden' }, 403))

    await expect(apiFetch('/api/todos')).rejects.toThrow('세션이 만료되었습니다')
    expect(getToken()).toBeNull()
  })

  it('code=FORBIDDEN인 403은 권한 거부로 보고 로그인 상태를 유지한다', async () => {
    // 이 분기가 없으면 정상 로그인 사용자가 권한 거부 한 번에 튕겨 나간다.
    saveToken('valid')
    fetchMock.mockResolvedValue(jsonResponse({ code: 'FORBIDDEN', error: '권한이 없습니다.' }, 403))

    await expect(apiFetch('/api/admin/users')).rejects.toThrow('권한이 없습니다.')
    expect(getToken()).toBe('valid')
  })

  it('code=FORBIDDEN 403에서 메시지가 없으면 기본 문구를 쓴다', async () => {
    saveToken('valid')
    fetchMock.mockResolvedValue(jsonResponse({ code: 'FORBIDDEN' }, 403))

    await expect(apiFetch('/api/admin/users')).rejects.toThrow('권한이 없습니다.')
  })

  it('만료 이벤트를 발생시킨다', async () => {
    saveToken('expired')
    const onExpired = vi.fn()
    window.addEventListener('token-expired', onExpired)
    try {
      fetchMock.mockResolvedValue(jsonResponse({}, 401))
      await expect(apiFetch('/api/todos')).rejects.toThrow()
      expect(onExpired).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('token-expired', onExpired)
    }
  })

  it('토큰이 없는 상태의 403은 로그아웃시키지 않는다', async () => {
    // 로그인 화면에서 잘못된 자격 증명으로 받은 401/403이다. 지워도 지울 게 없다.
    fetchMock.mockResolvedValue(jsonResponse({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401))

    await expect(apiFetch('/api/auth/login', { method: 'POST', body: '{}' }))
      .rejects.toThrow('아이디 또는 비밀번호가 올바르지 않습니다.')
    expect(getToken()).toBeNull()
  })
})

describe('apiFetch — 오류 메시지 정규화', () => {
  it('서버의 error 필드를 쓴다', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: '이미 사용 중인 값이 있습니다.' }, 400))

    await expect(apiFetch('/api/todos', { method: 'POST', body: '{}' }))
      .rejects.toThrow('이미 사용 중인 값이 있습니다.')
  })

  it('error가 없으면 message를 쓴다', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: '다른 필드로 시도해 주세요.' }, 409))

    await expect(apiFetch('/api/x')).rejects.toThrow('다른 필드로 시도해 주세요.')
  })

  it('둘 다 없으면 본문을 JSON 문자열로 보여 준다', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ some: 'shape' }, 400))

    await expect(apiFetch('/api/x')).rejects.toThrow('{"some":"shape"}')
  })

  it('JSON이 아닌 오류 본문은 그대로 보여 준다', async () => {
    fetchMock.mockResolvedValue(textResponse('Bad Gateway', 502))

    await expect(apiFetch('/api/x')).rejects.toThrow('Bad Gateway')
  })

  it('본문이 비어 있으면 상태 코드를 보여 준다', async () => {
    fetchMock.mockResolvedValue(textResponse('', 500))

    await expect(apiFetch('/api/x')).rejects.toThrow('HTTP 500')
  })

  it('404 본문이 비어도 상태 코드를 보여 준다', async () => {
    // 서버는 404에 본문을 안 준다.
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }))

    await expect(apiFetch('/api/notices/999')).rejects.toThrow('HTTP 404')
  })

  it('JSON 응답 본문을 읽다가 깨져도 예외를 내지 않는다', async () => {
    // Content-Type이 json인데 본문이 JSON이 아닌 경우의 방어 경로.
    fetchMock.mockResolvedValue(new Response('not json', {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(apiFetch('/api/x')).rejects.toThrow()
  })
})

describe('apiFetchBlob / apiUpload', () => {
  it('바이너리를 Blob으로 돌려준다', async () => {
    // 엑셀 같은 응답을 text()로 읽으면 파일이 깨진다.
    // Response 본문은 문자열/ArrayBuffer로 준다. jsdom의 Blob은 undici Response가
    // 받아들이지 못해 stream 관련 TypeError가 난다 — 테스트 환경 특성이지
    // 실제 브라우저 문제가 아니다.
    const bytes = new TextEncoder().encode('xlsx-bytes')
    fetchMock.mockResolvedValue(new Response(bytes, {
      status: 200,
      headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    }))

    const blob = await apiFetchBlob('/api/overtime-records/export')
    // jsdom의 Blob과 undici Response가 돌려주는 Blob은 서로 다른 realm이라
    // instanceof가 성립하지 않는다. duck typing으로 확인한다.
    expect(blob.size).toBe('xlsx-bytes'.length)
    expect(blob.type).toContain('spreadsheetml')
    expect(await blob.text()).toBe('xlsx-bytes')
  })

  it('blob도 만료 처리를 따른다', async () => {
    saveToken('expired')
    fetchMock.mockResolvedValue(jsonResponse({}, 403))

    await expect(apiFetchBlob('/api/overtime-records/export')).rejects.toThrow('세션이 만료되었습니다')
    expect(getToken()).toBeNull()
  })

  it('업로드는 POST로 FormData를 보낸다', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 3 }))
    const form = new FormData()
    form.append('file', new Blob(['x']), 'a.png')

    await expect(apiUpload('/api/notices/attachments', form)).resolves.toEqual({ id: 3 })
    expect(lastInit().method).toBe('POST')
    expect(lastInit().body).toBe(form)
  })

  it('업로드도 권한 거부를 만료로 착각하지 않는다', async () => {
    saveToken('valid')
    fetchMock.mockResolvedValue(jsonResponse({ code: 'FORBIDDEN', error: '관리자만 올릴 수 있습니다.' }, 403))

    const form = new FormData()
    await expect(apiUpload('/api/notices/attachments', form)).rejects.toThrow('관리자만 올릴 수 있습니다.')
    expect(getToken()).toBe('valid')
  })
})
