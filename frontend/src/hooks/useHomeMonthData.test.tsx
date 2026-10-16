import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import HomeMonthDataProvider from '../components/HomeMonthDataProvider'
import { useHomeMonthData } from './useHomeMonthData'

const api = vi.hoisted(() => ({ listEvents: vi.fn(), listTodos: vi.fn() }))
vi.mock('../api/calendar', () => ({ listEvents: api.listEvents }))
vi.mock('../api/todos', () => ({ listTodos: api.listTodos }))

function Consumer({ start, end, refreshVersion = 0 }: { start: string; end: string; refreshVersion?: number }) {
  const month = useHomeMonthData(start, end, refreshVersion)
  return (
    <div>
      <span data-testid="events">{month.events?.length ?? 'pending'}</span>
      <span data-testid="event-title">{month.events?.[0]?.title ?? ''}</span>
      <span data-testid="todos">{month.todos?.length ?? 'pending'}</span>
      {month.eventsError && <div role="alert">{month.eventsError}</div>}
      <button onClick={month.retry}>Retry month</button>
    </div>
  )
}

function TwinConsumers({ children }: { children: ReactNode }) {
  return <StrictMode><HomeMonthDataProvider>{children}</HomeMonthDataProvider></StrictMode>
}

describe('useHomeMonthData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listEvents.mockResolvedValue([])
    api.listTodos.mockResolvedValue([])
  })

  afterEach(() => cleanup())

  it('같은 달을 쓰는 위젯들이 월간 일정과 할 일을 한 번씩만 요청한다', async () => {
    render(
      <TwinConsumers>
        <>
          <Consumer start="2026-10-01" end="2026-10-31" />
          <Consumer start="2026-10-01" end="2026-10-31" />
        </>
      </TwinConsumers>,
    )

    await waitFor(() => expect(screen.getAllByTestId('events')[0].textContent).toBe('0'))
    expect(api.listEvents).toHaveBeenCalledTimes(1)
    expect(api.listTodos).toHaveBeenCalledTimes(1)
    expect(api.listEvents).toHaveBeenCalledWith('2026-10-01', '2026-10-31')
    expect(api.listTodos).toHaveBeenCalledWith('2026-10-01', '2026-10-31')
  })

  it('방문했던 달로 돌아오면 같은 갱신 세대의 캐시를 재사용한다', async () => {
    const view = render(
      <HomeMonthDataProvider>
        <Consumer start="2026-10-01" end="2026-10-31" />
      </HomeMonthDataProvider>,
    )
    await waitFor(() => {
      expect(api.listEvents).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('events').textContent).toBe('0')
    })

    view.rerender(
      <HomeMonthDataProvider>
        <Consumer start="2026-11-01" end="2026-11-30" />
      </HomeMonthDataProvider>,
    )
    await waitFor(() => {
      expect(api.listEvents).toHaveBeenCalledTimes(2)
      expect(screen.getByTestId('events').textContent).toBe('0')
    })

    view.rerender(
      <HomeMonthDataProvider>
        <Consumer start="2026-10-01" end="2026-10-31" />
      </HomeMonthDataProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('events').textContent).toBe('0'))
    expect(api.listEvents).toHaveBeenCalledTimes(2)
    expect(api.listTodos).toHaveBeenCalledTimes(2)
  })

  it('실패한 요청을 다시 시도할 수 있다', async () => {
    api.listEvents.mockRejectedValueOnce(new Error('월간 일정 오류')).mockResolvedValue([])
    render(
      <HomeMonthDataProvider>
        <>
          <Consumer start="2026-10-01" end="2026-10-31" />
          <Consumer start="2026-10-01" end="2026-10-31" />
        </>
      </HomeMonthDataProvider>,
    )

    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2))
    expect(screen.getAllByRole('alert')[0].textContent).toContain('월간 일정 오류')
    fireEvent.click(screen.getAllByRole('button', { name: 'Retry month' })[0])
    await waitFor(() => expect(api.listEvents).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getAllByTestId('events')[0].textContent).toBe('0'))
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
  })

  it('새로고침 요청이 먼저 끝나면 이전 응답이 최신 데이터를 덮지 않는다', async () => {
    let resolveFirst!: (events: Array<{ id: number; title: string; date: string; time?: string; scope: 'PRIVATE' }>) => void
    let resolveSecond!: (events: Array<{ id: number; title: string; date: string; time?: string; scope: 'PRIVATE' }>) => void
    api.listEvents
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve }))

    const view = render(
      <HomeMonthDataProvider>
        <Consumer start="2026-10-01" end="2026-10-31" />
      </HomeMonthDataProvider>,
    )
    await waitFor(() => expect(api.listEvents).toHaveBeenCalledTimes(1))

    view.rerender(
      <HomeMonthDataProvider>
        <Consumer start="2026-10-01" end="2026-10-31" refreshVersion={1} />
      </HomeMonthDataProvider>,
    )
    await waitFor(() => expect(api.listEvents).toHaveBeenCalledTimes(2))

    resolveSecond([{ id: 2, title: '최신 응답', date: '2026-10-02', scope: 'PRIVATE' }])
    await waitFor(() => expect(screen.getByTestId('event-title').textContent).toBe('최신 응답'))
    resolveFirst([{ id: 1, title: '오래된 응답', date: '2026-10-01', scope: 'PRIVATE' }])
    await waitFor(() => expect(screen.getByTestId('event-title').textContent).toBe('최신 응답'))
  })
})
