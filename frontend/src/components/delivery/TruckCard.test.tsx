import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import TruckCard from './TruckCard'
import type { Placed } from '../../utils/packing'

afterEach(cleanup)

/** 적재함 안의 한 칸. truck 번호는 카드에서 넘어오는 값이라 0으로 둔다. */
function placed(w: number, h: number, over: Partial<Placed> = {}): Placed {
  return { id: 1, truck: 0, x: 0, y: 0, w, h, rotated: false, ...over }
}

describe('TruckCard', () => {
  it('물품 수와 적재율을 보여 준다', () => {
    render(
      <TruckCard
        index={0}
        truck={[placed(600, 800), placed(600, 800)]}
        binW={1200}
        binH={800}
        nameMap={{ 1: '박스' }}
        collapsed={false}
        onToggle={() => {}}
      />,
    )
    expect(screen.getByText('물품 2개')).toBeTruthy()
    expect(screen.getByText('적재율 100%')).toBeTruthy()
  })

  it('트럭 번호는 1부터 센다', () => {
    // 내부 배열은 0부터라서, 0을 그대로 보여 주면 "트럭 0번"이 나온다.
    render(
      <TruckCard
        index={0}
        truck={[placed(100, 100)]}
        binW={1200}
        binH={800}
        nameMap={{ 1: '박스' }}
        collapsed={false}
        onToggle={() => {}}
      />,
    )
    expect(screen.getByText('트럭 1')).toBeTruthy()
  })

  it('적재율이 낮으면 낮은 톤을 쓴다', () => {
    const { container } = render(
      <TruckCard
        index={0}
        truck={[placed(100, 100)]}
        binW={1200}
        binH={800}
        nameMap={{ 1: '박스' }}
        collapsed={false}
        onToggle={() => {}}
      />,
    )
    // 숫자와 막대 색이 어긋나면 화면이 모순돼 보이므로 같은 클래스여야 한다
    expect(container.querySelector('.dl-truck-rate')?.className).toContain('dl-tone-low')
    expect(container.querySelector('.dl-bar-fill')?.className).toContain('dl-tone-low')
  })

  it('접으면 접힌 상태를 표시하고 펼치기를 알린다', () => {
    const { container, rerender } = render(
      <TruckCard
        index={0}
        truck={[placed(100, 100)]}
        binW={1200}
        binH={800}
        nameMap={{ 1: '박스' }}
        collapsed={false}
        onToggle={() => {}}
      />,
    )
    expect(container.querySelector('.dl-truck')?.className).not.toContain('is-collapsed')

    rerender(
      <TruckCard
        index={0}
        truck={[placed(100, 100)]}
        binW={1200}
        binH={800}
        nameMap={{ 1: '박스' }}
        collapsed
        onToggle={() => {}}
      />,
    )
    // 접었을 때 DOM에서 지우지 않는다. 인쇄할 때 접힌 트럭도 나와야 해서다.
    expect(container.querySelector('.dl-truck')?.className).toContain('is-collapsed')
    expect(container.querySelector('.dl-truck-figure')).toBeTruthy()
    expect(container.querySelector('.dl-truck-toggle')?.getAttribute('title')).toBe('펼치기')
    // 스크린리더에게 접힘 상태를 알려야 한다
    expect(container.querySelector('.dl-truck-toggle')?.getAttribute('aria-expanded')).toBe('false')
  })

  it('접기 버튼을 누르면 알린다', () => {
    const onToggle = vi.fn()
    const { container } = render(
      <TruckCard
        index={0}
        truck={[placed(100, 100)]}
        binW={1200}
        binH={800}
        nameMap={{ 1: '박스' }}
        collapsed={false}
        onToggle={onToggle}
      />,
    )
    // 접기/펼치기 문구는 title 속성이다(펼침 상태일 때 "접기"). 트럭 번호와 같은
    // 버튼 안에 들어 있어 getByText로는 걸리지 않는다.
    expect(container.querySelector('.dl-truck-toggle')?.getAttribute('title')).toBe('접기')
    fireEvent.click(container.querySelector('.dl-truck-toggle')!)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('이름별 수량을 칩으로 모은다', () => {
    // 칩 안에만 있는 이름이어야 한다. 도면의 <title>에도 같은 이름이 들어가
    // getByText로 잡으면 둘 다 걸린다.
    const { container } = render(
      <TruckCard
        index={0}
        truck={[
          placed(100, 100, { id: 1 }),
          placed(100, 100, { id: 1 }),
          placed(100, 100, { id: 2 }),
        ]}
        binW={1200}
        binH={800}
        nameMap={{ 1: '박스', 2: '끈' }}
        collapsed={false}
        onToggle={() => {}}
      />,
    )
    const chips = container.querySelector('.dl-chips')
    expect(chips?.textContent).toContain('박스')
    expect(chips?.textContent).toContain('×2')
    // 한 번만 있는 것은 수량을 붙이지 않는다
    expect(chips?.textContent).toContain('끈')
    expect(chips?.querySelector('.dl-chip-count')?.textContent).not.toBe('×1')
    expect(container.querySelectorAll('.dl-chip-count')).toHaveLength(1)
  })

  it('이름을 모르면 물품 번호로 대신 부른다', () => {
    const { container } = render(
      <TruckCard
        index={0}
        truck={[placed(100, 100, { id: 7 })]}
        binW={1200}
        binH={800}
        nameMap={{}}
        collapsed={false}
        onToggle={() => {}}
      />,
    )
    // nameMap에서 못 찾으면 "물품7"로 부른다(공백 없음)
    expect(container.querySelector('.dl-chips')?.textContent).toContain('물품7')
  })

  it('빈 트럭은 적재율 0으로 본다', () => {
    // 0으로 나누면 NaN이 되어 화면에 "NaN%"이 나온다.
    render(
      <TruckCard
        index={0}
        truck={[]}
        binW={1200}
        binH={800}
        nameMap={{}}
        collapsed={false}
        onToggle={() => {}}
      />,
    )
    expect(screen.getByText('적재율 0%')).toBeTruthy()
    expect(screen.getByText('물품 0개')).toBeTruthy()
  })
})