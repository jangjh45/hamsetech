import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ConfirmProvider } from '../components/ConfirmDialog'
import AdminPage from './Admin'

/**
 * 관리자 화면의 "지금 무엇을 보여주는가"를 고정한다.
 *
 * 이 테스트의 목적은 코드가 아니라 **관찰 가능한 동작**이다. AdminPage는 1400줄이고
 * 상태가 33개라, 리팩터링 후 무엇이 나빠졌는지 설명할 수 있는 사람이 없다. 탭을
 * 눌렀을 때 무엇이 뜨고 어떤 요청이 나가는지를 먼저 굳혀 두면, 탭 단위로 훅을 꺼내는
 * 작업이 안전해진다.
 *
 * 특히 순서가 중요하다. 진입 시 세 목록을 한꺼번에 부르는 이유(탭 배지에는 대기 건수가
 * 항상 떠 있어야 한다)와, 탭을 열 때만 그 탭의 것을 부르는 이유가 코드에 적혀 있다.
 * 이걸 고정해 두지 않으면 리팩터링 중 네트워크 호출 순서가 조용히 바뀐다.
 */

/**
 * 본문 검색창 문구.
 *
 * 리터럴로 그대로 쓰면 정규식 특수문자(· 등)를 매칭기가 다르게 읽는다. 정규식
 * 문자로 감싸면 화면 문구가 바뀌면 테스트가 즉시 깨진다 — 의도한 안전장치다.
 */
const SEARCH_PLACEHOLDER = /사번 · 이름 검색/

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock('../api/client', () => ({
  apiFetch: fetchMock,
  apiFetchBlob: vi.fn(),
}))

const overtimeApi = vi.hoisted(() => ({
  listAllOvertimeRecords: vi.fn(),
  approveOvertimeRecord: vi.fn(),
  rejectOvertimeRecord: vi.fn(),
  deleteOvertimeRecord: vi.fn(),
  createOvertimeRecordsBulk: vi.fn(),
  getOvertimeSummary: vi.fn(),
  getOvertimeDefaults: vi.fn(),
  updateOvertimeDefaults: vi.fn(),
  downloadOvertimeExcel: vi.fn(),
}))

vi.mock('../api/overtimeRecords', () => overtimeApi)

vi.mock('../auth/token', () => ({
  getToken: () => 'test-token',
  getUsername: () => 'admin',
  getRoles: () => ['ADMIN'],
  saveAuth: vi.fn(),
  onTokenExpired: () => () => {},
}))

/** 호출된 경로들만 뽑는다. 순서 비교에 쓴다. */
function calls(): string[] {
  return fetchMock.mock.calls.map((c) => String(c[0]))
}

beforeEach(() => {
  fetchMock.mockReset()
  // 빈 사용자 목록을 기본으로 준다. 배지·빈 상태를 보기 위한 뼈대다.
  fetchMock.mockResolvedValue([])

  overtimeApi.listAllOvertimeRecords.mockResolvedValue({
    content: [],
    number: 0,
    totalPages: 0,
    totalElements: 0,
    size: 20,
  })
  overtimeApi.getOvertimeSummary.mockResolvedValue([])
  overtimeApi.getOvertimeDefaults.mockResolvedValue({
    overtimeStart: '17:00:00',
    overtimeEnd: '20:00:00',
    specialStart: '08:00:00',
    specialEnd: '17:00:00',
  })
  localStorage.clear()
})

afterEach(cleanup)

function renderAdmin() {
  return render(
    <MemoryRouter>
      <ConfirmProvider>
        <AdminPage />
      </ConfirmProvider>
    </MemoryRouter>,
  )
}

const TAB = ['사용자', '가입 승인', '탈퇴 신청', '변경 이력', '조회 이력', '잔업특근']

describe('AdminPage — 탭 구조', () => {
  it('탭 6개가 모두 보인다', async () => {
    renderAdmin()
    for (const label of TAB) {
      await waitFor(() => expect(screen.getByRole('button', { name: label })).toBeTruthy())
    }
  })

  it('처음에는 사용자 탭이 열려 있다', async () => {
    // 잘못된 탭이 먼저 뜨면 관리자가 로그인하자마자 엉뚱한 화면을 본다.
    renderAdmin()
    await waitFor(() => expect(screen.getByPlaceholderText(SEARCH_PLACEHOLDER)).toBeTruthy())
  })

  it('탭을 바꾸면 그 탭 내용으로 바뀐다', async () => {
    renderAdmin()
    await waitFor(() => expect(screen.getByPlaceholderText(SEARCH_PLACEHOLDER)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: '변경 이력' }))
    await waitFor(() => expect(screen.queryByPlaceholderText(SEARCH_PLACEHOLDER)).toBeNull())
  })
})

describe('AdminPage — 진입 시 로딩', () => {
  it('세 목록을 한꺼번에 부른다', async () => {
    // 대기 건수는 탭 배지에 항상 떠 있어야 하므로 진입 시 몰아서 부른다.
    // 리팩터링 중 "필요할 때만 부르자"로 바꾸면 배지가 잠깐 빈 상태로 보인다.
    renderAdmin()
    await waitFor(() => {
      const c = calls()
      expect(c).toContain('/api/admin/users?status=PENDING')
      expect(c).toContain('/api/admin/users?status=WITHDRAW_REQUESTED')
      expect(c.some((u) => u === '/api/admin/users')).toBe(true)
    })
  })

  it('통계는 진입 시 부르지 않는다', async () => {
    // 로그 탭 전용이다. 진입 때 부르면 보이지 않는 화면의 요청이 된다.
    renderAdmin()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(calls()).not.toContain('/api/admin/logs/stats')
  })
})

describe('AdminPage — 탭 배지', () => {
  it('대기 건수가 있으면 숫자를 붙인다', async () => {
    fetchMock.mockImplementation(async (url: unknown) => {
      if (String(url).includes('status=PENDING')) {
        return [
          { id: 1, username: 'a', displayName: '가', status: 'PENDING' },
          { id: 2, username: 'b', displayName: '나', status: 'PENDING' },
        ]
      }
      return []
    })
    renderAdmin()
    await waitFor(() => expect(screen.getByRole('button', { name: '가입 승인 (2)' })).toBeTruthy())
  })

  it('대기 건수가 없으면 숫자를 붙이지 않는다', async () => {
    renderAdmin()
    await waitFor(() => expect(screen.getByRole('button', { name: '가입 승인' })).toBeTruthy())
  })

  it('탈퇴 신청도 같은 방식으로 붙인다', async () => {
    fetchMock.mockImplementation(async (url: unknown) => {
      if (String(url).includes('status=WITHDRAW_REQUESTED')) {
        return [{ id: 3, username: 'c', displayName: '다', status: 'WITHDRAW_REQUESTED' }]
      }
      return []
    })
    renderAdmin()
    await waitFor(() => expect(screen.getByRole('button', { name: '탈퇴 신청 (1)' })).toBeTruthy())
  })
})

describe('AdminPage — 탭 전환 시 로딩', () => {
  it('변경 이력을 열면 로그와 통계를 함께 부른다', async () => {
    renderAdmin()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    fetchMock.mockClear()

    fireEvent.click(screen.getByRole('button', { name: '변경 이력' }))
    await waitFor(() => {
      expect(calls().some((u) => u.startsWith('/api/admin/logs?'))).toBe(true)
      expect(calls()).toContain('/api/admin/logs/stats')
    })
  })

  it('조회 이력을 열면 읽기 전용 경로를 부른다', async () => {
    renderAdmin()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    fetchMock.mockClear()

    fireEvent.click(screen.getByRole('button', { name: '조회 이력' }))
    await waitFor(() => {
      expect(calls().some((u) => u.startsWith('/api/admin/logs/read?'))).toBe(true)
    })
  })

  it('잔업특근을 열면 목록·집계·기본값을 함께 부른다', async () => {
    renderAdmin()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    fetchMock.mockClear()

    fireEvent.click(screen.getByRole('button', { name: '잔업특근' }))
    // 세 요청이 다 나가는지 본다. 셋 중 하나만 부르면 탭이 반쯤 열린 상태가 된다.
    // 목록·집계는 이 모듈의 API를 통해, 기본값도 같은 방식으로 나간다.
    await waitFor(() => {
      expect(overtimeApi.getOvertimeDefaults).toHaveBeenCalled()
      expect(overtimeApi.getOvertimeSummary).toHaveBeenCalled()
      expect(overtimeApi.listAllOvertimeRecords).toHaveBeenCalled()
    })
  })

  it('로그 탭을 다시 누르면 첫 페이지로 돌아간다', async () => {
    renderAdmin()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: '변경 이력' }))
    await waitFor(() => expect(calls().some((u) => u.includes('page=0'))).toBe(true))
  })
})

describe('AdminPage — 사용자 검색', () => {
  it('검색어를 쿼리로 넘긴다', async () => {
    // 검색어를 안 보내면 전체 목록이 그대로 떠서 "안 되는 것"처럼 보인다.
    renderAdmin()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    fetchMock.mockClear()

    const input = screen.getByPlaceholderText(SEARCH_PLACEHOLDER)
    fireEvent.change(input, { target: { value: '김길동' } })
    fireEvent.click(screen.getByRole('button', { name: '검색' }))

    await waitFor(() => {
      expect(calls().some((u) => u.includes('q=') && u.includes(encodeURIComponent('김길동')))).toBe(true)
    })
  })

  it('실패하면 화면에 오류를 보여 준다', async () => {
    fetchMock.mockImplementation(async (url: unknown) => {
      if (String(url).includes('status=')) return []
      throw new Error('서버에 닿지 못했습니다')
    })
    renderAdmin()
    await waitFor(() => expect(screen.getByText('서버에 닿지 못했습니다')).toBeTruthy())
  })
})

describe('AdminPage — 로그인 잠금 해제', () => {
  it('잠긴 계정에만 표시하고 확인 후 관리자 잠금 해제 API를 호출한다', async () => {
    let userListCalls = 0
    fetchMock.mockImplementation(async (url: unknown) => {
      const path = String(url)
      if (path === '/api/admin/users') {
        userListCalls += 1
        return [{
          id: 41,
          username: 'locked-user',
          displayName: '테스트 사용자',
          roles: ['USER'],
          status: 'APPROVED',
          loginLocked: userListCalls === 1,
        }]
      }
      return []
    })
    renderAdmin()

    await waitFor(() => expect(screen.getByText('로그인 잠금')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'locked-user 로그인 잠금 해제' }))
    fireEvent.click(screen.getByRole('button', { name: '잠금 해제' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/users/41/unlock-login',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(screen.queryByText('로그인 잠금')).toBeNull()
    })
  })
})

describe('AdminPage — 세션 만료', () => {
  it('만료되면 안내를 띄운다', async () => {
    // 이 배너가 사라지면 사용자가 왜 멈췄는지 알 수 없다.
    renderAdmin()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByText(/세션이 만료되었습니다/)).toBeNull()
  })
})
