import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { SERVER_ERROR_EVENT } from '../api/serverErrorEvent'
import { NotifyProvider, useNotify } from './Toast'

/** 퇴장 애니메이션이 끝나 DOM에서 빠지기까지 넉넉히 기다리는 시간. */
const EXIT_WAIT = 400

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function Harness() {
  const { notify, clear } = useNotify()
  return (
    <div>
      <button onClick={() => notify({ message: '저장에 실패했습니다.', tone: 'error' })}>실패 알림</button>
      <button onClick={() => notify({ message: '저장되었습니다.', tone: 'success' })}>성공 알림</button>
      <button onClick={() => notify({ message: '계속 떠 있는 알림', tone: 'warning', duration: 0 })}>고정 알림</button>
      <button onClick={() => clear()}>모두 닫기</button>
    </div>
  )
}

function renderHarness() {
  return render(
    <NotifyProvider>
      <Harness />
    </NotifyProvider>,
  )
}

function toastOf(message: string): HTMLElement {
  return screen.getByText(message).closest('.fl-toast') as HTMLElement
}

describe('NotifyProvider', () => {
  it('톤에 맞는 기본 제목과 메시지를 보여 준다', () => {
    renderHarness()
    fireEvent.click(screen.getByRole('button', { name: '실패 알림' }))

    const toast = toastOf('저장에 실패했습니다.')
    expect(within(toast).getByText('문제가 생겼어요')).toBeTruthy()
    expect(toast.classList.contains('is-error')).toBe(true)
  })

  it('시간이 지나면 퇴장 상태로 바뀐 뒤 DOM에서 빠진다', () => {
    renderHarness()
    fireEvent.click(screen.getByRole('button', { name: '실패 알림' }))

    act(() => { vi.advanceTimersByTime(5999) })
    expect(toastOf('저장에 실패했습니다.').classList.contains('is-leaving')).toBe(false)

    act(() => { vi.advanceTimersByTime(1) })
    expect(toastOf('저장에 실패했습니다.').classList.contains('is-leaving')).toBe(true)

    act(() => { vi.advanceTimersByTime(EXIT_WAIT) })
    expect(screen.queryByText('저장에 실패했습니다.')).toBeNull()
  })

  it('duration이 0이면 직접 닫을 때까지 남는다', () => {
    renderHarness()
    fireEvent.click(screen.getByRole('button', { name: '고정 알림' }))

    act(() => { vi.advanceTimersByTime(60_000) })
    expect(toastOf('계속 떠 있는 알림').classList.contains('is-leaving')).toBe(false)
  })

  it('마우스가 올라가 있는 동안은 닫히지 않고, 내리면 남은 시간만큼 뒤에 닫힌다', () => {
    renderHarness()
    fireEvent.click(screen.getByRole('button', { name: '성공 알림' }))
    const toast = toastOf('저장되었습니다.')

    act(() => { vi.advanceTimersByTime(3000) })
    fireEvent.mouseEnter(toast)
    act(() => { vi.advanceTimersByTime(10_000) })
    expect(toast.classList.contains('is-leaving')).toBe(false)

    fireEvent.mouseLeave(toast)
    act(() => { vi.advanceTimersByTime(999) })
    expect(toast.classList.contains('is-leaving')).toBe(false)
    act(() => { vi.advanceTimersByTime(1) })
    expect(toast.classList.contains('is-leaving')).toBe(true)
  })

  it('닫기 버튼을 누르면 퇴장한 뒤 사라진다', () => {
    renderHarness()
    fireEvent.click(screen.getByRole('button', { name: '실패 알림' }))
    const toast = toastOf('저장에 실패했습니다.')

    fireEvent.click(within(toast).getByRole('button', { name: '알림 닫기' }))
    expect(toast.classList.contains('is-leaving')).toBe(true)

    act(() => { vi.advanceTimersByTime(EXIT_WAIT) })
    expect(screen.queryByText('저장에 실패했습니다.')).toBeNull()
  })

  it('같은 메시지는 쌓지 않고 한 개로 유지한다', () => {
    renderHarness()
    fireEvent.click(screen.getByRole('button', { name: '실패 알림' }))
    fireEvent.click(screen.getByRole('button', { name: '실패 알림' }))
    fireEvent.click(screen.getByRole('button', { name: '실패 알림' }))

    expect(screen.getAllByText('저장에 실패했습니다.')).toHaveLength(1)
  })

  it('동시에 떠 있는 알림은 최대 4개이고, 넘치면 오래된 것부터 퇴장한다', () => {
    function Many() {
      const { notify } = useNotify()
      return (
        <button onClick={() => {
          for (let i = 1; i <= 5; i += 1) notify({ message: `알림 ${i}` })
        }}>
          다섯 개
        </button>
      )
    }
    render(
      <NotifyProvider>
        <Many />
      </NotifyProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '다섯 개' }))

    expect(toastOf('알림 1').classList.contains('is-leaving')).toBe(true)
    expect(toastOf('알림 2').classList.contains('is-leaving')).toBe(false)
    expect(toastOf('알림 5').classList.contains('is-leaving')).toBe(false)

    act(() => { vi.advanceTimersByTime(EXIT_WAIT) })
    expect(screen.queryByText('알림 1')).toBeNull()
    expect(screen.getByText('알림 2')).toBeTruthy()
  })

  it('clear를 부르면 떠 있는 알림이 모두 퇴장한 뒤 사라진다', () => {
    renderHarness()
    fireEvent.click(screen.getByRole('button', { name: '실패 알림' }))
    fireEvent.click(screen.getByRole('button', { name: '고정 알림' }))

    fireEvent.click(screen.getByRole('button', { name: '모두 닫기' }))
    expect(toastOf('저장에 실패했습니다.').classList.contains('is-leaving')).toBe(true)
    expect(toastOf('계속 떠 있는 알림').classList.contains('is-leaving')).toBe(true)

    act(() => { vi.advanceTimersByTime(EXIT_WAIT) })
    expect(screen.queryByText('저장에 실패했습니다.')).toBeNull()
    expect(screen.queryByText('계속 떠 있는 알림')).toBeNull()
  })

  it('서버 오류(5xx) 이벤트를 받으면 전역 안내를 띄운다', () => {
    renderHarness()
    act(() => {
      window.dispatchEvent(new CustomEvent(SERVER_ERROR_EVENT, { detail: { kind: 'server', status: 500 } }))
    })
    expect(screen.getByText('서버에 일시적인 문제가 생겼습니다. 잠시 후 다시 시도해주세요.')).toBeTruthy()
  })

  it('네트워크 오류 이벤트는 연결 안내로 띄우고, 서버 오류와 따로 쌓인다', () => {
    renderHarness()
    act(() => {
      window.dispatchEvent(new CustomEvent(SERVER_ERROR_EVENT, { detail: { kind: 'server', status: 502 } }))
      window.dispatchEvent(new CustomEvent(SERVER_ERROR_EVENT, { detail: { kind: 'network' } }))
      window.dispatchEvent(new CustomEvent(SERVER_ERROR_EVENT, { detail: { kind: 'network' } }))
    })
    expect(screen.getByText('서버에 연결하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.')).toBeTruthy()
    expect(screen.getByText('서버에 일시적인 문제가 생겼습니다. 잠시 후 다시 시도해주세요.')).toBeTruthy()
    expect(screen.getAllByText(/서버에 연결하지 못했습니다/)).toHaveLength(1)
  })
})
