import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import OvertimeRecordsPage from './OvertimeRecords'

/**
 * 직원의 개인 잔업/특근 화면이 "지금 무엇을 보여주는가"를 고정한다.
 *
 * 이 화면은 794줄이고 테스트가 하나도 없다. 관리자 쪽 잔업 탭에는 특성 테스트가
 * 있으므로 짝이 안 맞는다 — 사원은 자신이 쓴 기록만 보고, 직원이 관리자 화면과
 * 같은 통계를 본다고 착각하기 쉽다.
 *
 * 특히 세 가지를 본다. 셋 다 화면이 조용히 잘못되는 사정이 있어서다.
 * - 이번 달 통계가 다른 달 기록까지 끌어들이지 않는가
 * - 승인된 기록을 수정하려 하면 다시 대기로 돌아간다고 알려주는가 (안 알려주면
 *   재승인 없이 반영될 것처럼 보여Silence 편집해 버린다)
 * - 시간을 안 넣고 총 시간만 넣으면 된다 — 길이가 다른 근무를 위한 갈 길
 */

const api = vi.hoisted(() => ({
  listMyOvertimeRecords: vi.fn(),
  createOvertimeRecord: vi.fn(),
  updateOvertimeRecord: vi.fn(),
  deleteOvertimeRecord: vi.fn(),
  getOvertimeDefaults: vi.fn(),
}))

vi.mock('../api/overtimeRecords', () => api)

/** 이번 달 YYYY-MM. 화면이 처음 여는 달과 같아야 통계에 잡힌다. */
function thisMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function ymd(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, '0')}`
}

function rec(over: Partial<Parameters<typeof makeRec>[0]> = {}) {
  return makeRec(over)
}

function makeRec(over: Partial<Record<string, unknown>> = {}) {
  const month = thisMonth()
  return {
    id: 1,
    userId: 7,
    username: 'kim',
    workDate: ymd(month, 10),
    type: 'OVERTIME' as const,
    startTime: '18:00:00',
    endTime: '21:00:00',
    totalMinutes: 180,
    reason: '마감',
    status: 'PENDING' as const,
    rejectReason: null,
    approverUsername: null,
    approvedAt: null,
    createdAt: `${month}-10T10:00:00`,
    updatedAt: `${month}-10T10:00:00`,
    ...over,
  }
}

beforeEach(() => {
  api.listMyOvertimeRecords.mockResolvedValue([])
  api.createOvertimeRecord.mockResolvedValue({})
  api.updateOvertimeRecord.mockResolvedValue({})
  api.deleteOvertimeRecord.mockResolvedValue({})
  api.getOvertimeDefaults.mockResolvedValue({
    overtimeStart: '17:00:00',
    overtimeEnd: '20:00:00',
    specialStart: '09:00:00',
    specialEnd: '18:00:00',
    payrollStartDay: 1,
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <OvertimeRecordsPage />
    </MemoryRouter>,
  )
}

/** 등록/수정 폼. '근무일'이 목록 표 머리글에도 있으므로 반드시 이 안에서 찾아야 한다. */
function dialog(): HTMLElement {
  return screen.getByRole('dialog')
}

/** 근무일 입력. label 텍스트가 표 머리글과 겹친다. */
function workDateInput(): HTMLInputElement {
  return within(dialog()).getByLabelText('근무일') as HTMLInputElement
}

function stat(label: string): HTMLElement {
  return screen.getByText(label).closest('.fl-stat') as HTMLElement
}

function timeInputs(): HTMLInputElement[] {
  return [...dialog().querySelectorAll<HTMLInputElement>('input[type="time"]')]
}

/**
 * 등록 폼을 연다.
 *
 * 기본 근무시간이 도착한 뒤에 눌러야 한다. 폼은 여는 **시점의** defaults를 복사해
 * 넣는데, 아직 안 왔으면 시간이 비어 있는 폼이 열린다. 이 테스트들은 정상 사용
 * (페이지가 떴을 때)을 재현한다. 그 경쟁 자체는 아래 '아직 안 왔으면 빈 폼이 열린다'
 * 가 고정한다.
 */
async function openCreateModal() {
  await waitFor(() => expect(api.getOvertimeDefaults).toHaveBeenCalled())
  await act(async () => {}) // then(setDefaults)이 반영될 틈
  fireEvent.click(screen.getByRole('button', { name: '기록 등록' }))
  await waitFor(() => expect(within(dialog()).getByText(/기본 17:00/)).toBeTruthy())
}

/** 제출 버튼. 저장 중에는 라벨이 바뀐다. */
function submitButton(): HTMLElement {
  return within(dialog()).getByRole('button', { name: /등록|저장/ })
}

describe('OvertimeRecordsPage — 불러오기', () => {
  it('내 기록과 기본 근무시간을 함께 읽는다', async () => {
    renderPage()
    await waitFor(() => expect(api.listMyOvertimeRecords).toHaveBeenCalled())
    // 기본 근무시간이 없으면 등록 폼의 시간이 비어 있다. 조용히 실패해도
    // 화면은 떠야 한다 — 편의 기능이기 때문이다.
    await waitFor(() => expect(api.getOvertimeDefaults).toHaveBeenCalled())
  })

  it('기본 근무시간을 못 읽어도 화면은 정상 동작한다', async () => {
    api.getOvertimeDefaults.mockRejectedValue(new Error('서버 오류'))
    renderPage()
    await waitFor(() => expect(screen.getByText('잔업 / 특근')).toBeTruthy())
  })

  it('목록을 못 읽으면 배너에 사유를 보인다', async () => {
    api.listMyOvertimeRecords.mockRejectedValue(new Error('권한이 없습니다'))
    renderPage()
    await waitFor(() => expect(screen.getByText('권한이 없습니다')).toBeTruthy())
  })

  it('기록이 없으면 빈 상태를 보인다', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('조건에 맞는 기록이 없습니다.')).toBeTruthy())
  })
})

describe('OvertimeRecordsPage — 이번 달 통계', () => {
  it('다른 달 기록은 통계에 넣지 않는다', async () => {
    const month = thisMonth()
    api.listMyOvertimeRecords.mockResolvedValue([
      rec({ id: 1, totalMinutes: 120 }),
      rec({ id: 2, workDate: ymd(month, 11), totalMinutes: 90 }),
      // 지난달 것. 이게 섞이면 이번 달 총 시간이 틀린다.
      rec({ id: 3, workDate: '2020-01-15', totalMinutes: 999 }),
    ])
    renderPage()

    // 120 + 90 = 210분 = 3시간 30분
    await waitFor(() => {
      expect(within(stat('이번 달 잔업')).getByText('3')).toBeTruthy()
      expect(within(stat('이번 달 잔업')).getByText('30')).toBeTruthy()
    })
  })

  it('잔업과 특근을 따로 센다', async () => {
    api.listMyOvertimeRecords.mockResolvedValue([
      rec({ id: 1, type: 'OVERTIME', totalMinutes: 120 }),
      rec({ id: 2, type: 'SPECIAL', totalMinutes: 480 }),
    ])
    renderPage()

    await waitFor(() => {
      expect(within(stat('이번 달 잔업')).getByText('2')).toBeTruthy() // 120분 = 2시간
      expect(within(stat('이번 달 특근')).getByText('8')).toBeTruthy() // 480분 = 8시간
    })
  })

  it('같은 날 두 건은 하루로 센다', async () => {
    api.listMyOvertimeRecords.mockResolvedValue([
      rec({ id: 1, totalMinutes: 60 }),
      rec({ id: 2, totalMinutes: 60 }),
    ])
    renderPage()
    // "2일"로 세면 근무일수 신세가 된다. 같은 날짜는 한 일이다.
    await waitFor(() => {
      expect(screen.getByText(/1일 · 저녁 휴게 30분 차감/)).toBeTruthy()
    })
  })

  it('승인된 건은 승인 시간까지 더한다', async () => {
    api.listMyOvertimeRecords.mockResolvedValue([
      rec({ id: 1, status: 'APPROVED', totalMinutes: 300 }),
      rec({ id: 2, status: 'PENDING', totalMinutes: 60 }),
    ])
    renderPage()
    await waitFor(() => {
      const card = document.querySelector<HTMLElement>('.fl-stat-grid')!
      // 승인 300분 = 5시간만. 대기 60분은 반영되지 않아야 한다.
      expect(within(card).getAllByText('5').length).toBeGreaterThan(0)
    })
  })
})

describe('OvertimeRecordsPage — 필터', () => {
  it('상태로 거른다', async () => {
    api.listMyOvertimeRecords.mockResolvedValue([
      rec({ id: 1, status: 'PENDING', reason: '발주 마감' }),
      rec({ id: 2, status: 'REJECTED', reason: '출고 지연' }),
    ])
    renderPage()
    await waitFor(() => expect(screen.getByText('발주 마감')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: '승인' }))
    // 승인된 게 없으면 전부 사라져야 한다.
    await waitFor(() => expect(screen.getByText('조건에 맞는 기록이 없습니다.')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: '반려' }))
    await waitFor(() => expect(screen.getByText('출고 지연')).toBeTruthy())
  })

  it('구분으로 거른다', async () => {
    api.listMyOvertimeRecords.mockResolvedValue([
      rec({ id: 1, type: 'OVERTIME', reason: '평일 연장' }),
      rec({ id: 2, type: 'SPECIAL', reason: '휴일 근무' }),
    ])
    renderPage()
    await waitFor(() => expect(screen.getByText('평일 연장')).toBeTruthy())

    fireEvent.change(screen.getByLabelText('구분 필터'), { target: { value: 'SPECIAL' } })
    await waitFor(() => expect(screen.queryByText('평일 연장')).toBeNull())
    expect(screen.getByText('휴일 근무')).toBeTruthy()
  })

  it('조회 월을 바꾸면 그 달 기록만 본다', async () => {
    api.listMyOvertimeRecords.mockResolvedValue([rec({ id: 1 })])
    renderPage()
    await waitFor(() => expect(screen.getByText('마감')).toBeTruthy())

    fireEvent.change(screen.getByLabelText('조회 월'), { target: { value: '2020-01' } })
    await waitFor(() => expect(screen.getByText('조건에 맞는 기록이 없습니다.')).toBeTruthy())
  })
})

describe('OvertimeRecordsPage — 기록 등록', () => {
  it('등록 폼이 기본 근무시간으로 채워져 열린다', async () => {
    renderPage()
    await openCreateModal()
    const [start, end] = timeInputs().map((el) => el.value)
    expect(start).toBe('17:00')
    expect(end).toBe('20:00')
    // 저녁 17:00–17:30 휴게를 빼면 150분이다. 표기가 이 값이어야 사안이 안 갈린다.
    expect(within(dialog()).getByText('2시간 30분')).toBeTruthy()
  })

  it('근무일을 비우면 등록하지 않는다', async () => {
    renderPage()
    await openCreateModal()

    fireEvent.change(workDateInput(), { target: { value: '' } })
    // 근무일 칸에 required가 걸려 있어 브라우저는 제출을 막고 네이티브 메시지를 낸다.
    // 그 뒤의 코드가 방어선이다 — 폼을 직접 submit해 그 경로를 확인한다.
    fireEvent.submit(dialog())
    await waitFor(() => expect(screen.getByText('근무일을 입력해주세요')).toBeTruthy())
    expect(api.createOvertimeRecord).not.toHaveBeenCalled()
  })

  it('시간도 총 시간도 안 넣으면 등록하지 않는다', async () => {
    renderPage()
    await openCreateModal()

    // 기본값이 있으면 이 경로에 안 걸린다. 폼을 비워서 확인한다.
    for (const el of timeInputs()) fireEvent.change(el, { target: { value: '' } })
    fireEvent.click(submitButton())
    await waitFor(() =>
      expect(screen.getByText('시작–종료 시간 또는 총 시간을 입력해주세요')).toBeTruthy(),
    )
    expect(api.createOvertimeRecord).not.toHaveBeenCalled()
  })

  it('총 시간만 넣으면 등록한다', async () => {
    // 휴일 근무는 시작·종료가 의미 없다. 총 시간만 가는 길이 있어야 한다.
    renderPage()
    await openCreateModal()

    for (const el of timeInputs()) fireEvent.change(el, { target: { value: '' } })
    fireEvent.change(screen.getByPlaceholderText('예: 120분'), { target: { value: '240' } })
    fireEvent.click(submitButton())

    await waitFor(() => expect(api.createOvertimeRecord).toHaveBeenCalled())
    expect(api.createOvertimeRecord.mock.calls[0][0]).toMatchObject({
      totalMinutes: 240,
      startTime: null,
      endTime: null,
    })
  })

  it('등록한 달로 따라간다', async () => {
    // 다른 달에 등록하면 그 달로 옮겨 가지 않으면 방금 넣은 기록이 안 보인다.
    renderPage()
    await openCreateModal()

    fireEvent.change(workDateInput(), { target: { value: '2021-06-15' } })
    fireEvent.click(submitButton())
    await waitFor(() => expect(api.createOvertimeRecord).toHaveBeenCalled())
    // 폼은 그 달로 따라가야 하는데, 폼 닫히기 전에 조회 월부터 갱신되어야 한다.
    await waitFor(() =>
      expect((screen.getByLabelText('조회 월') as HTMLInputElement).value).toBe('2021-06'),
    )
  })

  it('기본 근무시간이 아직 안 왔으면 시간이 빈 폼이 열린다', async () => {
    // 지금 있는 동작을 고정한다. 폼이 여는 시점의 defaults를 복사하기 때문에 늦게
    // 누르면 빈 폼이 열린다. 이게 버그인지 확인은 별도 — 여기서는 "무슨 일이 벌어지나"
    // 만 굳힌다.
    api.getOvertimeDefaults.mockReturnValue(new Promise(() => {})) // 영원히 미 도착
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '기록 등록' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())
    expect(timeInputs().map((el) => el.value)).toEqual(['', ''])
  })

  it('Esc로 모달을 닫는다', async () => {
    renderPage()
    await openCreateModal()

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

describe('OvertimeRecordsPage — 승인된 기록 수정', () => {
  it('수정하면 재승인이 필요하다고 먼저 묻는다', async () => {
    api.listMyOvertimeRecords.mockResolvedValue([rec({ id: 1, status: 'APPROVED' })])
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderPage()
    await waitFor(() => expect(screen.getByText('마감')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('수정'))
    // "거절"하면 폼이 열리면 안 된다.
    expect(confirmSpy).toHaveBeenCalled()
    expect(confirmSpy.mock.calls[0][0]).toMatch(/재승인/)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('대기 중인 기록은 묻지 않고 바로 연다', async () => {
    api.listMyOvertimeRecords.mockResolvedValue([rec({ id: 1, status: 'PENDING' })])
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderPage()
    await waitFor(() => expect(screen.getByText('마감')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('수정'))
    // 이미 대기 중이므로 묻지 않는다.
    expect(confirmSpy).not.toHaveBeenCalled()
    await waitFor(() => expect(workDateInput()).toBeTruthy())
  })
})