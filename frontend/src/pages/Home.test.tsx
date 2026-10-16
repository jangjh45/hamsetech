import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import HomePage from './Home'

const api = vi.hoisted(() => ({ useDashboardData: vi.fn(), useHomeMonthData: vi.fn() }))
vi.mock('../hooks/useDashboardData', () => ({ default: api.useDashboardData }))
vi.mock('../hooks/useHomeMonthData', () => ({ useHomeMonthData: api.useHomeMonthData }))
vi.mock('../components/HomeMonthDataProvider', () => ({ default: ({ children }: { children: ReactNode }) => children }))
vi.mock('../auth/token', () => ({ getUsername: () => 'kim' }))
vi.mock('../components/Clock', () => ({ default: () => null }))
vi.mock('../components/CalendarWidget', () => ({
  default: ({ selected }: { selected: string }) => <div data-testid="calendar-date">{selected}</div>,
}))
vi.mock('../components/TodoList', () => ({
  default: ({ selectedDate }: { selectedDate: string }) => <div data-testid="todo-date">{selectedDate}</div>,
}))
vi.mock('../components/RecentNotices', () => ({ default: () => null }))
vi.mock('../components/OvertimeSummary', () => ({ default: () => null }))
vi.mock('../components/TodayScheduleWidget', () => ({ default: () => null }))
vi.mock('../components/ShortcutsWidget', () => ({ default: () => null }))
vi.mock('../components/HomeEditPanel', () => ({ default: () => null }))

describe('HomePage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    api.useDashboardData.mockReturnValue({
      todayDate: '2026-10-16',
      monthOvertime: [],
      overdueTodos: { count: 2, earliestDate: '2026-10-14' },
      loading: false,
      errors: { overtime: '', overdueTodos: '' },
      refreshVersion: 0,
      refreshSummary: vi.fn(),
      refresh: vi.fn(),
    })
    api.useHomeMonthData.mockReturnValue({
      version: '0:0',
      events: [],
      todos: [],
      eventsLoading: false,
      todosLoading: false,
      eventsError: '',
      todosError: '',
      retry: vi.fn(),
      updateEvents: vi.fn(),
      updateTodos: vi.fn(),
    })
    HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => cleanup())

  it('밀린 할 일 링크를 누르면 가장 오래된 미완료 날짜를 할 일 위젯에 연다', () => {
    render(<HomePage />)

    fireEvent.click(screen.getByRole('button', { name: '가장 오래된 밀린 할 일 확인 →' }))

    expect(screen.getByTestId('todo-date').textContent).toBe('2026-10-14')
    expect(screen.getByTestId('calendar-date').textContent).toBe('2026-10-14')
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
  })
})
