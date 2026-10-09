import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProfilePage from './Profile'

/**
 * 내 정보 화면이 "지금 무엇을 보여주는가"를 고정한다.
 *
 * 526줄이고 테스트가 하나도 없다. 이 화면은 계정 자체를 건드리는 자리라 —
 * 비밀번호 변경, 회원 탈퇴, 로그아웃 — 화면이 조용히 잘못되면 복구가 어렵다.
 *
 * 특히 다섯 가지를 본다.
 * - 탈퇴를 '신청'하면 로그아웃하지 않는다. 관리자가 확정하기 전까지 그대로 쓰고,
 *   되돌릴 수 있어야 한다. 확정과 신청을 헷갈리면 계정이 사라진다.
 * - SUPER_ADMIN에게는 탈퇴 버튼이 아예 없다. 스스로 나가면 아무도 승인할 수 없다.
 * - 탈퇴 신청에도 비밀번호를 요구한다. 세션이 살아 있다는 사실만으로 탈퇴되면 안 된다.
 * - 이번 달 잔업 지표가 0이면 '없음'을 보인다. 0시간을 보여주면 실력이 없는 것처럼
 *   읽힌다.
 * - 표시 이름을 바꾸면 헤더 칩도 따라간다(재로그인까지 옛 이름을 물고 있지 않게).
 */

const api = vi.hoisted(() => ({ fetch: vi.fn() }))
const auth = vi.hoisted(() => ({
  clearToken: vi.fn(),
  saveDisplayName: vi.fn(),
}))
const overtime = vi.hoisted(() => ({ listMyOvertimeRecords: vi.fn() }))

vi.mock('../api/client', () => ({ apiFetch: api.fetch }))
vi.mock('../api/overtimeRecords', () => overtime)
vi.mock('../auth/token', () => auth)

const profile = (over: Record<string, unknown> = {}) => ({
  username: 'kim',
  email: 'kim@hamsetech.kr',
  displayName: '김철수',
  roles: ['USER'],
  status: 'ACTIVE',
  withdrawRequestedAt: null,
  withdrawReason: null,
  ...over,
})

let calls: { url: string; method?: string; body?: unknown }[]

beforeEach(() => {
  calls = []
  // vi.restoreAllMocks()가 vi.fn의 구현까지 지우므로 여기서 다시 심는다.
  overtime.listMyOvertimeRecords.mockResolvedValue([])
  api.fetch.mockImplementation((url: string, init?: RequestInit) => {
    calls.push({
      url,
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    if (url === '/api/users/me' && (!init?.method || init.method === 'GET')) {
      return Promise.resolve(profile())
    }
    return Promise.resolve({})
  })
  auth.clearToken.mockClear()
  auth.saveDisplayName.mockClear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  )
}

/** 이름이 요약 헤더와 표시 이름 칸 두 곳에 나온다. */
function loaded() {
  return expect(screen.getAllByText('김철수').length).toBeGreaterThan(0)
}

/** placeholder로 찾으면 탈퇴 폼의 '현재 비밀번호'와 겹친다. id로 건진다. */
function byId(id: string): HTMLInputElement {
  return document.getElementById(id) as HTMLInputElement
}

/** 보기/숨기기 버튼이 세 칸에 각각 붙어 있다. */
function pwToggle(): HTMLElement {
  return screen.getAllByTitle(/비밀번호 (보기|숨기기)/)[0]
}

/** 탈퇴 신청 폼의 비밀번호 칸. 비밀번호 변경 칸과 placeholder가 같다. */
function withdrawPasswordInput(): HTMLInputElement {
  return byId('pf-wd-pw')
}

describe('ProfilePage — 불러오기', () => {
  it('프로필과 이번 달 잔업을 함께 읽는다', async () => {
    renderPage()
    await waitFor(loaded)
    expect(overtime.listMyOvertimeRecords).toHaveBeenCalled()
  })

  it('읽는 중에는 로딩 문구를 보인다', () => {
    api.fetch.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText('로딩 중...')).toBeTruthy()
  })

  it('프로필을 못 읽으면 사유를 보인다', async () => {
    api.fetch.mockRejectedValue(new Error('세션이 만료되었습니다'))
    renderPage()
    await waitFor(() => expect(screen.getByText('세션이 만료되었습니다')).toBeTruthy())
  })

  it('표시 이름이 없으면 아이디로 대체한다', async () => {
    api.fetch.mockImplementation((url: string, init?: RequestInit) =>
      url === '/api/users/me' && !init?.method
        ? Promise.resolve(profile({ displayName: '' }))
        : Promise.resolve({}),
    )
    renderPage()
    // 헤더 이름이 아이디로 채워진다. 누가 계정인지 모른다.
    await waitFor(() => expect(document.querySelector('.pf-name')!.textContent).toBe('kim'))
  })
})

describe('ProfilePage — 이번 달 잔업 지표', () => {
  it('지표를 못 읽으면 조용히 감춘다', async () => {
    overtime.listMyOvertimeRecords.mockRejectedValue(new Error('실패'))
    renderPage()
    await waitFor(loaded)
    // 지표는 부가 정보다. 실패하면 아예 없는 게 맞다 — 0으로 보이면 거짓말이 된다.
    expect(screen.queryByText('이번 달 잔업·특근')).toBeNull()
  })

  it('0분이면 0시간이 아니라 없음이라고 본다', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('이번 달 잔업·특근')).toBeTruthy())
    expect(screen.getByText('없음')).toBeTruthy()
  })

  it('이번 달 1일~月末 사이만 물어본다', async () => {
    renderPage()
    await waitFor(() => expect(overtime.listMyOvertimeRecords).toHaveBeenCalled())
    const [from, to] = overtime.listMyOvertimeRecords.mock.calls[0] as string[]
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    expect(from).toBe(`${y}-${m}-01`)
    // to는 그 달 마지막 날이다. 1일로만 좁히면 첫 달 지표가 0으로 보인다.
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()
    expect(to).toBe(`${y}-${m}-${String(lastDay).padStart(2, '0')}`)
  })
})

describe('ProfilePage — 표시 이름', () => {
  it('저장하면 헤더 칩도 따라간다', async () => {
    renderPage()
    await waitFor(loaded)

    api.fetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/users/me' && init?.method === 'PUT') {
        return Promise.resolve(profile({ displayName: '김영희' }))
      }
      return Promise.resolve(profile())
    })

    fireEvent.click(screen.getByRole('button', { name: '수정' }))
    fireEvent.change(screen.getByLabelText('표시 이름'), { target: { value: '김영희' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(screen.getByText('표시 이름을 저장했습니다.')).toBeTruthy())
    expect(document.querySelector('.pf-name')!.textContent).toBe('김영희')
    // 헤더 유저 칩이 재로그인까지 옛 이름을 물고 있지 않게 해야 한다.
    expect(auth.saveDisplayName).toHaveBeenCalledWith('김영희')
  })

  it('취소하면 서버에 보내지 않는다', async () => {
    renderPage()
    await waitFor(loaded)

    fireEvent.click(screen.getByRole('button', { name: '수정' }))
    fireEvent.change(screen.getByLabelText('표시 이름'), { target: { value: '지운이름' } })
    fireEvent.click(screen.getByRole('button', { name: '취소' }))

    await waitFor(() => expect(screen.queryByLabelText('표시 이름')).toBeNull())
    expect(document.querySelector('.pf-namefield-value')!.textContent).toBe('김철수')
    expect(calls.some((c) => c.method === 'PUT')).toBe(false)
  })

  it('저장에 실패하면 편집창을 그대로 두고 사유를 보인다', async () => {
    renderPage()
    await waitFor(loaded)

    api.fetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/users/me' && init?.method === 'PUT') {
        return Promise.reject(new Error('표시 이름은 20자까지입니다'))
      }
      return Promise.resolve(profile())
    })

    fireEvent.click(screen.getByRole('button', { name: '수정' }))
    fireEvent.change(screen.getByLabelText('표시 이름'), { target: { value: '아주 긴 이름' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(screen.getByText('표시 이름은 20자까지입니다')).toBeTruthy())
    // 입력한 값을 잃으면 다시 치워야 한다.
    expect((screen.getByLabelText('표시 이름') as HTMLInputElement).value).toBe('아주 긴 이름')
  })
})

describe('ProfilePage — 비밀번호 변경', () => {
  it('세 칸을 다 채우기 전에는 버튼이 눌리지 않는다', async () => {
    renderPage()
    await waitFor(loaded)
    const btn = () => screen.getByRole('button', { name: '비밀번호 변경' }) as HTMLButtonElement
    expect(btn().disabled).toBe(true)

    fireEvent.change(screen.getByPlaceholderText('현재 비밀번호'), { target: { value: 'old1234' } })
    expect(btn().disabled).toBe(true)
  })

  it('8자 미만이면 서버에 보내지 않는다', async () => {
    renderPage()
    await waitFor(loaded)

    fireEvent.change(screen.getByPlaceholderText('현재 비밀번호'), { target: { value: 'old1234' } })
    fireEvent.change(screen.getByPlaceholderText('8자 이상'), { target: { value: 'short1!' } })
    fireEvent.change(screen.getByPlaceholderText('한 번 더 입력'), { target: { value: 'short1!' } })
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))

    await waitFor(() => expect(screen.getByText('새 비밀번호는 8자 이상이어야 합니다.')).toBeTruthy())
    expect(calls.some((c) => c.url.includes('change-password'))).toBe(false)
  })

  it('두 칸이 다르면 서버에 보내지 않는다', async () => {
    renderPage()
    await waitFor(loaded)

    fireEvent.change(screen.getByPlaceholderText('현재 비밀번호'), { target: { value: 'old1234' } })
    fireEvent.change(screen.getByPlaceholderText('8자 이상'), { target: { value: 'brandnew1!' } })
    fireEvent.change(screen.getByPlaceholderText('한 번 더 입력'), { target: { value: 'brandnew2!' } })
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))

    await waitFor(() => expect(screen.getByText('새 비밀번호가 일치하지 않습니다.')).toBeTruthy())
    expect(calls.some((c) => c.url.includes('change-password'))).toBe(false)
  })

  it('일치하면 바로 알려준다', async () => {
    renderPage()
    await waitFor(loaded)

    fireEvent.change(screen.getByPlaceholderText('8자 이상'), { target: { value: 'brandnew1!' } })
    fireEvent.change(screen.getByPlaceholderText('한 번 더 입력'), { target: { value: 'brandnew1!' } })
    // 틀렸을 때는 바로 알려주고, 맞았을 때는 바로 맞다고 말해야 한다.
    await waitFor(() => expect(screen.getByText('비밀번호가 일치합니다')).toBeTruthy())
    expect(screen.queryByText('비밀번호가 일치하지 않습니다')).toBeNull()
  })

  it('바꾸면 세 칸을 모두 비운다', async () => {
    renderPage()
    await waitFor(loaded)

    fireEvent.change(screen.getByPlaceholderText('현재 비밀번호'), { target: { value: 'old1234' } })
    fireEvent.change(screen.getByPlaceholderText('8자 이상'), { target: { value: 'brandnew1!' } })
    fireEvent.change(screen.getByPlaceholderText('한 번 더 입력'), { target: { value: 'brandnew1!' } })
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }))

    await waitFor(() => expect(screen.getByText('비밀번호가 변경되었습니다.')).toBeTruthy())
    // 새 비밀번호가 화면에 남아 있으면 눈치챌 수 있다. 다 비워야 한다.
    expect((screen.getByPlaceholderText('8자 이상') as HTMLInputElement).value).toBe('')
    expect((screen.getByPlaceholderText('현재 비밀번호') as HTMLInputElement).value).toBe('')
    expect((screen.getByPlaceholderText('한 번 더 입력') as HTMLInputElement).value).toBe('')
  })

  it('보기/숨기기가 세 칸을 함께 다룬다', async () => {
    renderPage()
    await waitFor(loaded)

    expect(byId('pf-current').type).toBe('password')
    fireEvent.click(pwToggle())
    expect(byId('pf-current').type).toBe('text')
    expect(byId('pf-new').type).toBe('text')
    fireEvent.click(pwToggle())
    expect(byId('pf-current').type).toBe('password')
  })
})

describe('ProfilePage — 회원 탈퇴', () => {
  it('SUPER_ADMIN에게는 탈퇴 버튼이 없다', async () => {
    api.fetch.mockImplementation((url: string, init?: RequestInit) =>
      url === '/api/users/me' && !init?.method
        ? Promise.resolve(profile({ roles: ['SUPER_ADMIN'] }))
        : Promise.resolve({}),
    )
    renderPage()
    await waitFor(loaded)
    // 스스로 나가면 아무도 가입·탈퇴를 승인할 수 없게 된다.
    expect(screen.queryByRole('button', { name: '회원 탈퇴 신청' })).toBeNull()
  })

  it('비밀번호를 요구한다', async () => {
    renderPage()
    await waitFor(loaded)

    fireEvent.click(screen.getByRole('button', { name: '회원 탈퇴 신청' }))
    const btn = screen.getByRole('button', { name: '탈퇴 신청하기' }) as HTMLButtonElement
    // 세션이 살아 있다는 사실만으로 탈퇴되면 안 된다.
    expect(btn.disabled).toBe(true)

    fireEvent.change(withdrawPasswordInput(), { target: { value: 'old1234' } })
    expect(btn.disabled).toBe(false)
  })

  it('신청해도 로그아웃하지 않는다', async () => {
    renderPage()
    await waitFor(loaded)

    api.fetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/users/me/withdraw' && init?.method === 'POST') {
        return Promise.resolve({})
      }
      if (url === '/api/users/me' && !init?.method) {
        // 신청이 반영된 뒤 다시 읽는 프로필
        return Promise.resolve(
          profile({
            status: 'WITHDRAW_REQUESTED',
            withdrawRequestedAt: '2026-03-01T10:00:00',
            withdrawReason: '이직',
          }),
        )
      }
      return Promise.resolve({})
    })

    fireEvent.click(screen.getByRole('button', { name: '회원 탈퇴 신청' }))
    fireEvent.change(withdrawPasswordInput(), { target: { value: 'old1234' } })
    fireEvent.change(
      screen.getByPlaceholderText('관리자에게 전달할 내용이 있다면 적어 주세요'),
      { target: { value: '이직' } },
    )
    fireEvent.click(screen.getByRole('button', { name: '탈퇴 신청하기' }))

    await waitFor(() => expect(screen.getByText(/탈퇴를 신청했습니다/)).toBeTruthy())
    // 여기서 로그아웃하면 관리자 확정 전에 계정을 잃는다.
    expect(auth.clearToken).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '탈퇴 신청 취소' })).toBeTruthy()
  })

  it('신청 취소하면 다시 신청할 수 있다', async () => {
    // 서버 상태를 흉내낸다. 취소 전엔 신청 상태, 취소 후엔 일반 상태.
    let requested = true
    let canceled = false
    api.fetch.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/users/me/withdraw' && init?.method === 'DELETE') {
        requested = false
        canceled = true
      }
      if (url === '/api/users/me' && !init?.method) {
        return Promise.resolve(requested ? profile({ status: 'WITHDRAW_REQUESTED' }) : profile())
      }
      return Promise.resolve({})
    })
    renderPage()
    await waitFor(() => expect(screen.getByText(/탈퇴를 신청했습니다/)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: '탈퇴 신청 취소' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '회원 탈퇴 신청' })).toBeTruthy())
    expect(canceled).toBe(true)
  })

  it('신청에 실패하면 사유를 보인다', async () => {
    renderPage()
    await waitFor(loaded)

    api.fetch.mockImplementation((url: string) => {
      if (url === '/api/users/me/withdraw') return Promise.reject(new Error('비밀번호가 맞지 않습니다'))
      return Promise.resolve(profile())
    })

    fireEvent.click(screen.getByRole('button', { name: '회원 탈퇴 신청' }))
    fireEvent.change(withdrawPasswordInput(), { target: { value: 'wrongpwd' } })
    fireEvent.click(screen.getByRole('button', { name: '탈퇴 신청하기' }))

    await waitFor(() => expect(screen.getByText('비밀번호가 맞지 않습니다')).toBeTruthy())
  })

  it('로그아웃은 토큰을 지운다', async () => {
    renderPage()
    await waitFor(loaded)
    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
    expect(auth.clearToken).toHaveBeenCalled()
  })
})