import { describe, expect, it } from 'vitest'
import { MAX_PIECES, packIntoTrucks, type Placed, type Rect } from './packing'

// 적재 결과의 불변식. 개별 좌표까지 박아 두면 정렬 힌트를 손보는 것만으로도
// 전부 깨진다. 대신 "어떤 배치에서도 반드시 성립해야 하는 것"만 건다.
function assertNoOverlap(placed: Placed[]): void {
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]
      const b = placed[j]
      const overlapX = a.x < b.x + b.w && a.x + a.w > b.x
      const overlapY = a.y < b.y + b.h && a.y + a.h > b.y
      expect(
        overlapX && overlapY,
        `id ${a.id}(${a.x},${a.y},${a.w},${a.h}) 가 id ${b.id}(${b.x},${b.y},${b.w},${b.h}) 와 겹친다`,
      ).toBe(false)
    }
  }
}

function assertInsideBin(placed: Placed[], binW: number, binH: number): void {
  for (const p of placed) {
    expect(p.x).toBeGreaterThanOrEqual(0)
    expect(p.y).toBeGreaterThanOrEqual(0)
    // 마진은 물품 사이 간격이라 화면 좌표는 적재함 크기를 넘지 않아야 한다.
    expect(p.x + p.w).toBeLessThanOrEqual(binW + 1e-9)
    expect(p.y + p.h).toBeLessThanOrEqual(binH + 1e-9)
  }
}

describe('packIntoTrucks — 배치 불변식', () => {
  it('겹치는 물품을 만들지 않는다', () => {
    const items: Rect[] = [
      { id: 1, w: 60, h: 40, qty: 12 },
      { id: 2, w: 30, h: 30, qty: 15 },
      { id: 3, w: 80, h: 25, qty: 8 },
      { id: 4, w: 20, h: 90, qty: 6 },
    ]
    const result = packIntoTrucks(items, 120, 100)

    expect(result.aborted).toBe(false)
    for (const truck of result.trucks) assertNoOverlap(truck)
  })

  it('모든 물품을 적재함 안에 둔다', () => {
    const result = packIntoTrucks(
      [{ id: 1, w: 40, h: 40, qty: 20 }, { id: 2, w: 25, h: 55, qty: 10 }],
      100, 100,
    )
    for (const truck of result.trucks) assertInsideBin(truck, 100, 100)
  })

  it('회전 여부가 표시 치수와 일치한다', () => {
    const result = packIntoTrucks([{ id: 1, w: 30, h: 70, qty: 6 }], 100, 100)

    for (const truck of result.trucks) {
      for (const p of truck) {
        const upright = p.w === 30 && p.h === 70
        const rotated = p.w === 70 && p.h === 30
        expect(upright || rotated).toBe(true)
        expect(p.rotated).toBe(rotated)
      }
    }
  })

  it('모든 조각을 배치하거나 unplaceable로 보고한다', () => {
    const items: Rect[] = [
      { id: 1, w: 40, h: 40, qty: 10 },
      { id: 2, w: 200, h: 200, qty: 3 }, // 적재함보다 크다
      { id: 3, w: 30, h: 30, qty: 5 },
    ]
    const result = packIntoTrucks(items, 100, 100)

    const placedIds = result.trucks.flat().map(p => p.id)
    const placedCount = placedIds.length
    const droppedCount = items.find(i => i.id === 2)!.qty!

    expect(placedCount + droppedCount).toBe(result.pieceCount)
    expect(result.unplaceable).toContain(2)
    expect(result.unplaceable).not.toContain(1)
    expect(result.unplaceable).not.toContain(3)
  })

  it('pieceCount는 수량을 펼친 총 조각 수다', () => {
    const result = packIntoTrucks(
      [{ id: 1, w: 10, h: 10, qty: 4 }, { id: 2, w: 10, h: 10, qty: 6 }],
      100, 100,
    )
    expect(result.pieceCount).toBe(10)
  })
})

describe('packIntoTrucks — 수량 전개와 입력 방어', () => {
  it('qty가 없으면 1개로 본다', () => {
    const result = packIntoTrucks([{ id: 1, w: 10, h: 10 }], 100, 100)
    expect(result.pieceCount).toBe(1)
  })

  it('0×0이나 0 수량은 유령 물품을 만들지 않는다', () => {
    // 예전엔 qty 0을 1로 올려서 0×0 유령 물품이 결과에 섞였다.
    const result = packIntoTrucks(
      [
        { id: 1, w: 0, h: 0, qty: 5 },
        { id: 2, w: 20, h: 20, qty: 0 },
        { id: 3, w: 20, h: 20, qty: 2 },
      ],
      100, 100,
    )
    expect(result.pieceCount).toBe(2)
    expect(result.trucks.flat().map(p => p.id)).toEqual([3, 3])
  })

  it('치수가 0 이하인 행은 입력 중인 것으로 보고 건너뛴다', () => {
    const result = packIntoTrucks(
      [{ id: 1, w: -10, h: 20, qty: 3 }, { id: 2, w: 20, h: 20, qty: 1 }],
      100, 100,
    )
    expect(result.pieceCount).toBe(1)
  })

  it('적재함이 0 이하이면 계산하지 않고 실패한다', () => {
    expect(() => packIntoTrucks([{ id: 1, w: 10, h: 10 }], 0, 100)).toThrow()
    expect(() => packIntoTrucks([{ id: 1, w: 10, h: 10 }], 100, -1)).toThrow()
  })

  it('물품이 없으면 트럭도 만들지 않는다', () => {
    const result = packIntoTrucks([], 100, 100)
    expect(result.count).toBe(0)
    expect(result.trucks).toEqual([])
    expect(result.aborted).toBe(false)
  })

  it('유효 물품이 하나도 없으면 pieceCount도 0이다', () => {
    const result = packIntoTrucks([{ id: 1, w: 0, h: 0, qty: 9 }], 100, 100)
    expect(result.pieceCount).toBe(0)
    expect(result.count).toBe(0)
  })
})

describe('packIntoTrucks — MAX_PIECES 상한', () => {
  it('조각이 상한을 넘으면 계산을 포기하고 aborted로 알린다', () => {
    const result = packIntoTrucks([{ id: 1, w: 10, h: 10, qty: MAX_PIECES + 1 }], 500, 500)

    expect(result.aborted).toBe(true)
    expect(result.trucks).toEqual([])
    expect(result.count).toBe(0)
    expect(result.pieceCount).toBe(MAX_PIECES + 1)
  })

  it('상한과 정확히 같으면 계산한다', () => {
    const result = packIntoTrucks([{ id: 1, w: 10, h: 10, qty: MAX_PIECES }], 500, 500)

    expect(result.aborted).toBe(false)
    expect(result.pieceCount).toBe(MAX_PIECES)
    expect(result.count).toBeGreaterThan(0)
  })

  it('버려진 조각도 상한 계산에 포함된다', () => {
    // 0×0 행은 전개 단계에서 사라지므로 상한을 넘지 않는다.
    const result = packIntoTrucks(
      [{ id: 1, w: 0, h: 0, qty: MAX_PIECES + 50 }, { id: 2, w: 10, h: 10, qty: 3 }],
      100, 100,
    )
    expect(result.aborted).toBe(false)
    expect(result.pieceCount).toBe(3)
  })
})

describe('packIntoTrucks — 회전', () => {
  it('적재함 높이보다 긴 물품을 눕혀서라도 싣는다', () => {
    // 40×90은 높이 50인 적재함에 서면 아예 들어가지 않는다.
    const items: Rect[] = [{ id: 1, w: 40, h: 90, qty: 1 }]
    const binW = 100
    const binH = 50

    const withRotate = packIntoTrucks(items, binW, binH, { allowRotate: true })
    const withoutRotate = packIntoTrucks(items, binW, binH, { allowRotate: false })

    // 눕히면(90×40) 한 대에 들어간다.
    expect(withRotate.count).toBe(1)
    expect(withRotate.trucks[0][0]).toMatchObject({ w: 90, h: 40, rotated: true })
    // 서서 실으면 못 싣는다.
    expect(withoutRotate.count).toBe(0)
    expect(withoutRotate.unplaceable).toEqual([1])
  })

  it('회전해도 들어가지 않으면 트럭 수를 줄여 보이 않는다', () => {
    // 2개는 눕혀서 한 대에 들어가지만, 3개째부터는 새 트럭이 필요하다.
    const items: Rect[] = [{ id: 1, w: 40, h: 90, qty: 3 }]
    const result = packIntoTrucks(items, 100, 100, { allowRotate: true, margin: 0 })

    // 눕히면(90×40) 100×100에 2개까지 위아래로 들어간다.
    expect(result.trucks[0]).toHaveLength(2)
    expect(result.trucks[1]).toHaveLength(1)
    expect(result.count).toBe(2)
  })

  it('회전을 꺼도 제자리에 들어가는 물품의 방향을 바꾸지 않는다', () => {
    const result = packIntoTrucks([{ id: 1, w: 60, h: 30, qty: 3 }], 100, 100, { allowRotate: false })
    expect(result.trucks.flat().every(p => p.w === 60 && p.h === 30 && !p.rotated)).toBe(true)
  })
})

describe('packIntoTrucks — 마진', () => {
  it('마진은 물품 사이 간격이지 벽면 여백이 아니다', () => {
    // 적재함과 같은 크기의 물품도 마진만 주면 들어간다. 마진 때문에 적재함을
    // 키워 버리면 벽에 닿는 물품의 바깥 마진이 늘린 폭에 흡수된다.
    const result = packIntoTrucks([{ id: 1, w: 100, h: 100, qty: 1 }], 100, 100, { margin: 5 })

    expect(result.unplaceable).toEqual([])
    expect(result.count).toBe(1)
    expect(result.trucks[0][0]).toMatchObject({ x: 0, y: 0, w: 100, h: 100 })
  })

  it('마진이 없으면 적재함과 같은 크기의 물품도 들어간다', () => {
    const result = packIntoTrucks([{ id: 1, w: 100, h: 100, qty: 1 }], 100, 100)
    expect(result.count).toBe(1)
  })

  it('마진이 있으면 같은 물품이 덜 들어간다', () => {
    const items: Rect[] = [{ id: 1, w: 50, h: 50, qty: 4 }]

    const withoutMargin = packIntoTrucks(items, 100, 100, { margin: 0 })
    const withMargin = packIntoTrucks(items, 100, 100, { margin: 10 })

    expect(withMargin.trucks.flat().length).toBeLessThanOrEqual(withoutMargin.trucks.flat().length)
  })
})

describe('packIntoTrucks — 배치 순서와 재사용', () => {
  it('preserveOrder가 false면 면적 큰 순으로 처리한다', () => {
    // 50×50 하나와 20×20 다섯 개. 면적 순이면 큰 것부터 트럭을 열어서
    // 작은 것들이 그 트럭의 남은 공간을 채운다.
    const result = packIntoTrucks(
      [{ id: 1, w: 20, h: 20, qty: 5 }, { id: 1, w: 50, h: 50, qty: 1 }],
      100, 100,
      { preserveOrder: false },
    )

    expect(result.count).toBe(1)
    assertNoOverlap(result.trucks[0])
  })

  it('preserveOrder가 true면 입력 순서를 지킨다', () => {
    const result = packIntoTrucks(
      [{ id: 1, w: 20, h: 20, qty: 5 }, { id: 2, w: 50, h: 50, qty: 1 }],
      100, 100,
      { preserveOrder: true },
    )

    const firstOfFirstTruck = result.trucks[0][0]
    expect(firstOfFirstTruck.id).toBe(1)
  })

  it('앞 트럭이 꽉 차기 전에는 새 트럭을 열지 않는다 (First-Fit)', () => {
    // 40×40은 100×100에 2×2 = 4개까지 들어간다. 다섯 번째는 앞 트럭의
    // 남은 공간(20×100, 100×20 띠)에 들어가지 않아 두 번째 트럭을 연다.
    const result = packIntoTrucks([{ id: 1, w: 40, h: 40, qty: 5 }], 100, 100, { margin: 0 })

    expect(result.count).toBe(2)
    // Next-Fit이었다면 4개·1개로 나뉘었을 것이다. 여기선 앞 트럭을 최대화한다.
    expect(result.trucks[0]).toHaveLength(4)
    expect(result.trucks[1]).toHaveLength(1)
  })

  it('앞 트럭의 남은 공간을 뒤 물품이 재사용한다', () => {
    // 큰 물품을 먼저 실어야(면적 내림차순) 뒤의 작은 물품이 그 트럭을 채운다.
    const result = packIntoTrucks(
      [{ id: 1, w: 90, h: 90, qty: 1 }, { id: 2, w: 10, h: 10, qty: 1 }],
      100, 100,
      { margin: 0, preserveOrder: false },
    )

    expect(result.count).toBe(1)
    expect(result.trucks[0]).toHaveLength(2)
    assertNoOverlap(result.trucks[0])
  })

  it('적재함보다 큰 물품만 있으면 트럭을 만들지 않는다', () => {
    const result = packIntoTrucks([{ id: 1, w: 500, h: 500, qty: 3 }], 100, 100)

    expect(result.count).toBe(0)
    expect(result.trucks).toEqual([])
    expect(result.unplaceable).toEqual([1])
  })

  it('회전으로 들어가는 물품을 회전 없이 놓치지 않는다', () => {
    const result = packIntoTrucks([{ id: 1, w: 90, h: 45, qty: 2 }], 100, 100, { allowRotate: true })
    // 45×90 두 개는 세로로 들어간다.
    expect(result.count).toBe(1)
    expect(result.unplaceable).toEqual([])
  })

  it('truck 필드는 결과 배열의 인덱스와 일치한다', () => {
    const result = packIntoTrucks(
      [{ id: 1, w: 90, h: 90, qty: 3 }, { id: 2, w: 30, h: 30, qty: 2 }],
      100, 100,
      { allowRotate: false },
    )

    result.trucks.forEach((items, index) => {
      for (const p of items) expect(p.truck).toBe(index)
    })
  })
})
