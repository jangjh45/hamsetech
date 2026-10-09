import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ScenarioRow from './ScenarioRow'
import type { PackingScenario } from '../../api/scenarios'

afterEach(cleanup)

function scenario(over: Partial<PackingScenario> = {}): PackingScenario {
  return {
    id: 1,
    name: '8월 냉동창고',
    description: '',
    truckWidth: 6200,
    truckHeight: 2300,
    margin: 50,
    allowRotate: true,
    preserveOrder: false,
    isFavorite: false,
    items: [
      { id: 1, name: '박스', w: 400, h: 300, qty: 10 },
    ],
    createdAt: '2026-08-01T00:00:00',
    updatedAt: '2026-08-01T00:00:00',
    ...over,
  } as PackingScenario
}

describe('ScenarioRow', () => {
  it('이름과 적재 조건을 보여 준다', () => {
    render(
      <ScenarioRow
        scenario={scenario()}
        onLoad={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggleFavorite={() => {}}
      />,
    )
    expect(screen.getByText('8월 냉동창고')).toBeTruthy()
    // 치수가 잘못 저장되면 현장에서 그대로 쓸 수 있으므로 눈으로 확인되어야 한다
    expect(screen.getByText(/6200 × 2300 mm/)).toBeTruthy()
    expect(screen.getByText(/마진 50mm/)).toBeTruthy()
  })

  it('설명이 있으면 보여 주고 없으면 그리지 않는다', () => {
    const { container, rerender } = render(
      <ScenarioRow
        scenario={scenario({ description: '여름 성수기' })}
        onLoad={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggleFavorite={() => {}}
      />,
    )
    expect(screen.getByText('여름 성수기')).toBeTruthy()

    rerender(
      <ScenarioRow
        scenario={scenario()}
        onLoad={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggleFavorite={() => {}}
      />,
    )
    expect(container.querySelector('.dl-scenario-desc')).toBeNull()
  })

  it('회전 허용 여부를 구분해 보여 준다', () => {
    const { rerender } = render(
      <ScenarioRow
        scenario={scenario({ allowRotate: false })}
        onLoad={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggleFavorite={() => {}}
      />,
    )
    expect(screen.getByText(/회전 미허용/)).toBeTruthy()

    rerender(
      <ScenarioRow
        scenario={scenario({ allowRotate: true })}
        onLoad={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggleFavorite={() => {}}
      />,
    )
    expect(screen.getByText(/회전 허용/)).toBeTruthy()
  })

  it('입력 순서 적재는 켜졌을 때만 보여 준다', () => {
    const { container, rerender } = render(
      <ScenarioRow
        scenario={scenario({ preserveOrder: false })}
        onLoad={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggleFavorite={() => {}}
      />,
    )
    expect(screen.queryByText('입력 순서 적재')).toBeNull()

    rerender(
      <ScenarioRow
        scenario={scenario({ preserveOrder: true })}
        onLoad={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggleFavorite={() => {}}
      />,
    )
    expect(screen.getByText('입력 순서 적재')).toBeTruthy()
    expect(container.querySelector('.dl-scenario')).toBeTruthy()
  })

  it('즐겨찾기 상태를 별로 글자로 드러낸다', () => {
    // 아이콘만 있으면 상태를 알기 어렵다. title과 aria-label이 같은 말을 쓴다.
    const { rerender } = render(
      <ScenarioRow
        scenario={scenario({ isFavorite: true })}
        onLoad={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggleFavorite={() => {}}
      />,
    )
    expect(screen.getByLabelText('즐겨찾기 해제')).toBeTruthy()

    rerender(
      <ScenarioRow
        scenario={scenario({ isFavorite: false })}
        onLoad={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onToggleFavorite={() => {}}
      />,
    )
    expect(screen.getByLabelText('즐겨찾기 추가')).toBeTruthy()
  })

  it('네 동작을 각자 전달한다', () => {
    const onLoad = vi.fn()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const onToggleFavorite = vi.fn()
    render(
      <ScenarioRow
        scenario={scenario()}
        onLoad={onLoad}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleFavorite={onToggleFavorite}
      />,
    )

    fireEvent.click(screen.getByText('불러오기'))
    fireEvent.click(screen.getByText('수정'))
    fireEvent.click(screen.getByText('삭제'))
    fireEvent.click(screen.getByLabelText('즐겨찾기 추가'))

    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onToggleFavorite).toHaveBeenCalledTimes(1)
  })
})