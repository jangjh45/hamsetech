import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import OvertimeBulkModal from './OvertimeBulkModal'

const api = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  createOvertimeRecordsBulk: vi.fn(),
}))

vi.mock('../../api/client', () => ({ apiFetch: api.apiFetch }))
vi.mock('../../api/overtimeRecords', () => ({ createOvertimeRecordsBulk: api.createOvertimeRecordsBulk }))

const defaults = {
  overtimeStart: '16:00:00',
  overtimeEnd: '19:00:00',
  specialStart: '07:00:00',
  specialEnd: '16:00:00',
  payrollStartDay: 1,
}

describe('잔업특근 일괄 등록', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.apiFetch.mockResolvedValue([{ id: 1, username: 'user1', displayName: '홍길동', status: 'APPROVED' }])
    api.createOvertimeRecordsBulk.mockResolvedValue({ created: 1, records: [], skipped: [] })
  })

  afterEach(() => cleanup())

  it('휴게시간 차감 후 0분인 시간은 등록하지 않는다', async () => {
    render(<OvertimeBulkModal defaults={defaults} onClose={vi.fn()} onCreated={vi.fn()} />)

    await screen.findByText('홍길동')
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    const timeInputs = document.querySelectorAll<HTMLInputElement>('input[type="time"]')
    fireEvent.change(timeInputs[0], { target: { value: '17:00' } })
    fireEvent.change(timeInputs[1], { target: { value: '17:30' } })
    fireEvent.click(screen.getByRole('button', { name: '1명 등록' }))

    expect(await screen.findByText('휴게시간 차감 후 근무시간은 1분 이상이어야 합니다')).toBeTruthy()
    await waitFor(() => expect(api.createOvertimeRecordsBulk).not.toHaveBeenCalled())
  })
})
