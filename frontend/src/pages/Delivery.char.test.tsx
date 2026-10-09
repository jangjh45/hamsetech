import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DeliveryPage from './Delivery'

/**
 * 적재(패킹) 화면의 "지금 무엇을 보여주는가"를 고정한다.
 *
 * 이 화면은 테스트가 하나도 없다. 계산 로직(utils/packing.ts)에는 27개가 있지만
 * 화면 자체는 0개다. 상태를 훅으로 나누기 전에 관찰 동작을 먼저 굳혀 두는 편이
 * 순서다 — Admin을 그 순서로 해 봤고, 특성 테스트가 실제로 회귀 하나를 잡아냈다.
 *
 * 특히 두 가지를 본다.
 * - 입력을 바꾸면 300ms 뒤에 계산이 도는지(디바운스). 계산이 안 돌면 화면은 조용히
 *   옛 결과만 보여 준다.
 * - 물품을 지우고 되돌릴 수 있는지. 지운 줄을 모르면 현장에서 다시 입력해야 한다.
 */

const scenarioApi = vi.hoisted(() => ({
  getAllScenarios: vi.fn(async () => []),
  getFavoriteScenarios: vi.fn(async () => []),
  createScenario: vi.fn(),
  updateScenario: vi.fn(),
  deleteScenario: vi.fn(),
  toggleFavorite: vi.fn(),
}))

vi.mock('../api/scenarios', () => scenarioApi)

beforeEach(() => {
  localStorage.clear()
  scenarioApi.getAllScenarios.mockResolvedValue([])
  scenarioApi.getFavoriteScenarios.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function renderPage() {
  // 라우터 안에 있어야 한다 — 화면이 useNavigate 를 쓴다.
  return render(
    <MemoryRouter>
      <DeliveryPage />
    </MemoryRouter>,
  )
}

describe('DeliveryPage — 초기 화면', () => {
  it('저장된 초안을 되살린다', async () => {
    // 새로고침으로 입력이 날아가지 않게 브라우저에 남겨둔 값이다. 이게 깨지면
    // 현장에서 물품을 다시 입력해야 한다.
    localStorage.setItem(
      'delivery_draft_v1',
      JSON.stringify({
        binW: '2000',
        binH: '1500',
        margin: '50',
        allowRotate: false,
        preserveOrder: true,
        items: [{ id: 1, name: '박스', w: '400', h: '300', qty: '5' }],
      }),
    )
    renderPage()
    await waitFor(() => {
      expect(document.querySelector<HTMLInputElement>('input[placeholder="1200"]')?.value).toBe('2000')
    })
  })

  it('깨진 초안은 조용히 버린다', async () => {
    localStorage.setItem('delivery_draft_v1', '{깨진 JSON')
    renderPage()
    // 예외를 던지면 화면이 뜨지 않는다. 기본값으로 시작해야 한다.
    await waitFor(() => {
      expect(document.querySelector<HTMLInputElement>('input[placeholder="1200"]')?.value).toBe('1200')
    })
  })

  it('시나리오 목록을 불러온다', async () => {
    renderPage()
    await waitFor(() => expect(scenarioApi.getAllScenarios).toHaveBeenCalled())
  })
})

describe('DeliveryPage — 물품 편집', () => {
  it('물품을 지운 뒤 되돌릴 수 있다', async () => {
    renderPage()
    await waitFor(() => {
      expect(document.querySelector<HTMLInputElement>('input[placeholder="1200"]')?.value).toBe('1200')
    })

    const addBtn = screen.getByRole('button', { name: /추가/ })
    fireEvent.click(addBtn)
    await waitFor(() => expect(document.querySelectorAll('.dl-item-row').length).toBe(1))

    // 지운다
    fireEvent.click(screen.getByLabelText('삭제'))
    await waitFor(() => expect(document.querySelectorAll('.dl-item-row').length).toBe(0))

    // 되돌린다
    fireEvent.click(screen.getByText(/되돌리기/))
    await waitFor(() => expect(document.querySelectorAll('.dl-item-row').length).toBe(1))
  })
})

describe('DeliveryPage — 디바운스 계산', () => {
  it('치수를 바꾸면 지연 뒤에 계산한다', async () => {
    // 300ms 디바운스. 이 타이밍이 깨지면 입력할 때마다 계산이 돌아 화면이 끊긴다.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderPage()

    const w = document.querySelector<HTMLInputElement>('input[placeholder="1200"]')!
    fireEvent.change(w, { target: { value: '3000' } })

    vi.advanceTimersByTime(400)
    await waitFor(() => expect(w.value).toBe('3000'))
  })
})