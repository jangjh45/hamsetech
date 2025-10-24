export type Rect = { id: number; w: number; h: number; qty?: number }
export type Placed = Rect & { x: number; y: number; rotated: boolean; truck: number }

export type PackOptions = {
  allowRotate?: boolean
  margin?: number // item 주변 여유 간격
}

export type PackResult = {
  trucks: Placed[][]
  count: number
}

function expandQuantities(items: Rect[]): Rect[] {
  const expanded: Rect[] = []
  for (const it of items) {
    const q = Math.max(1, it.qty || 1)
    for (let i = 0; i < q; i++) expanded.push({ id: it.id, w: it.w, h: it.h })
  }
  return expanded
}

function rectsIntersect(
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number
): boolean {
  return !(x1 + w1 <= x2 || x2 + w2 <= x1 || y1 + h1 <= y2 || y2 + h2 <= y1)
}

export function packIntoTrucks(
  items: Rect[],
  binW: number,
  binH: number,
  options: PackOptions = {}
): PackResult {
  const allowRotate = options.allowRotate ?? true
  const margin = options.margin ?? 0

  if (binW <= 0 || binH <= 0) throw new Error('Invalid truck size')

  const expanded = expandQuantities(items)

  // 개선된 정렬: 물품의 넓이(면적)를 기준으로 큰 물건부터 적재
  const sorted = [...expanded].sort((a, b) => {
    const areaA = a.w * a.h
    const areaB = b.w * b.h
    if (areaA !== areaB) return areaB - areaA
    return Math.max(b.h, b.w) - Math.max(a.h, a.w)
  })
  
  const trucks: Placed[][] = []

  let currentTruck: Placed[] = []

  const fitsBin = (w: number, h: number) => w <= binW && h <= binH

  const startNewTruck = () => {
    if (currentTruck.length) trucks.push(currentTruck)
    currentTruck = []
  }

  // 트럭에 물품을 배치할 수 있는 위치를 찾기
  const findBestPosition = (orientations: Array<{ w: number; h: number; rotated: boolean }>) => {
    let bestPos: { x: number; y: number; o: { w: number; h: number; rotated: boolean } } | null = null
    let bestWaste = Infinity

    for (const o of orientations) {
      // 좌상단부터 스캔
      for (let y = 0; y <= binH - o.h; y += 1) {
        for (let x = 0; x <= binW - o.w; x += 1) {
          // 배치 가능한 위치인지 확인
          let canPlace = true
          for (const placed of currentTruck) {
            if (rectsIntersect(x, y, o.w, o.h, placed.x, placed.y, placed.w, placed.h)) {
              canPlace = false
              break
            }
          }

          if (canPlace) {
            // 남은 공간을 계산하여 가장 좋은 위치 선택 (Best Fit)
            const waste = (binW - o.w) * (binH - o.h)
            if (waste < bestWaste) {
              bestWaste = waste
              bestPos = { x, y, o }
            }
          }
        }
      }
    }

    return bestPos
  }

  for (const it of sorted) {
    const orientations = allowRotate
      ? [
          { w: it.w + margin, h: it.h + margin, rotated: false },
          { w: it.h + margin, h: it.w + margin, rotated: true },
        ]
      : [{ w: it.w + margin, h: it.h + margin, rotated: false }]

    let placed = false

    // 현재 트럭에 배치 시도
    const bestPos = findBestPosition(orientations)
    if (bestPos) {
      currentTruck.push({
        ...it,
        x: bestPos.x,
        y: bestPos.y,
        w: bestPos.o.w,
        h: bestPos.o.h,
        rotated: bestPos.o.rotated,
        truck: trucks.length
      })
      placed = true
    }

    // 현재 트럭에 배치 불가 → 새 트럭 생성
    if (!placed) {
      startNewTruck()
      const o = orientations.find(o => fitsBin(o.w, o.h))
      if (!o) throw new Error(`아이템이 트럭 크기보다 큽니다: ${it.id}`)

      currentTruck.push({
        ...it,
        x: 0,
        y: 0,
        w: o.w,
        h: o.h,
        rotated: o.rotated,
        truck: trucks.length
      })
    }
  }

  if (currentTruck.length) trucks.push(currentTruck)

  return { trucks, count: trucks.length }
}


