import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import useDashboardData from './useDashboardData'

const strictWrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>

const api = vi.hoisted(() => ({
  getOverdueTodoSummary: vi.fn(),
  listMyOvertimeRecords: vi.fn(),
}))

vi.mock('../api/todos', () => ({
  getOverdueTodoSummary: api.getOverdueTodoSummary,
}))
vi.mock('../api/overtimeRecords', () => ({ listMyOvertimeRecords: api.listMyOvertimeRecords }))

describe('useDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getOverdueTodoSummary.mockResolvedValue({ count: 0, earliestDate: null })
    api.listMyOvertimeRecords.mockResolvedValue([])
  })

  afterEach(() => cleanup())

  it('불러오는 동안 상태를 표시하고 요약 데이터를 제공한다', async () => {
    const { result } = renderHook(() => useDashboardData(), { wrapper: strictWrapper })
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.monthOvertime).toEqual([])
    expect(result.current.overdueTodos).toEqual({ count: 0, earliestDate: null })
    expect(result.current.errors).toEqual({ overtime: '', overdueTodos: '' })
    expect(api.getOverdueTodoSummary).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
    expect(api.listMyOvertimeRecords).toHaveBeenCalledTimes(1)
    expect(api.getOverdueTodoSummary).toHaveBeenCalledTimes(1)
  })

  it('실패한 요약은 빈 데이터로 오인하지 않고 다시 시도할 수 있다', async () => {
    api.getOverdueTodoSummary
      .mockRejectedValueOnce(new Error('밀린 할 일 API 오류'))
      .mockResolvedValue({ count: 2, earliestDate: '2026-10-14' })
    const { result } = renderHook(() => useDashboardData())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.overdueTodos).toBeNull()
    expect(result.current.errors.overdueTodos).toBe('밀린 할 일 API 오류')

    act(() => result.current.refresh())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.overdueTodos).toEqual({ count: 2, earliestDate: '2026-10-14' })
    expect(result.current.errors.overdueTodos).toBe('')
    expect(api.getOverdueTodoSummary).toHaveBeenCalledTimes(2)
  })

  it('탭으로 돌아오면 데이터를 다시 불러온다', async () => {
    renderHook(() => useDashboardData())
    await waitFor(() => expect(api.listMyOvertimeRecords).toHaveBeenCalledTimes(1))

    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await waitFor(() => expect(api.listMyOvertimeRecords).toHaveBeenCalledTimes(2))
  })
})
