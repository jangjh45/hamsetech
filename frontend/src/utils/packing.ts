export type Rect = { id: number; w: number; h: number; qty?: number }

export type Placed = {
  id: number
  x: number
  y: number
  w: number       // 화면 표시용 너비 (마진 제외)
  h: number       // 화면 표시용 높이 (마진 제외)
  rotated: boolean
  truck: number
}

export type PackOptions = {
  allowRotate?: boolean
  margin?: number
}

export type PackResult = {
  trucks: Placed[][]
  count: number
}

type FreeRect = { x: number; y: number; w: number; h: number }

type Orientation = {
  displayW: number
  displayH: number
  packW: number   // 마진 포함 패킹용 너비
  packH: number   // 마진 포함 패킹용 높이
  rotated: boolean
}

function expandQuantities(items: Rect[]): Rect[] {
  const expanded: Rect[] = []
  for (const it of items) {
    const q = Math.max(1, it.qty || 1)
    for (let i = 0; i < q; i++) {
      expanded.push({ id: it.id, w: it.w, h: it.h })
    }
  }
  return expanded
}

function rectsOverlap(
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number
): boolean {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2
}

function updateFreeRects(
  freeRects: FreeRect[],
  placed: { x: number; y: number; w: number; h: number }
): FreeRect[] {
  const newFreeRects: FreeRect[] = []

  for (const free of freeRects) {
    if (!rectsOverlap(free.x, free.y, free.w, free.h, placed.x, placed.y, placed.w, placed.h)) {
      newFreeRects.push(free)
      continue
    }

    // 왼쪽
    if (placed.x > free.x) {
      newFreeRects.push({ x: free.x, y: free.y, w: placed.x - free.x, h: free.h })
    }
    // 오른쪽
    const rightEdge = placed.x + placed.w
    const freeRightEdge = free.x + free.w
    if (rightEdge < freeRightEdge) {
      newFreeRects.push({ x: rightEdge, y: free.y, w: freeRightEdge - rightEdge, h: free.h })
    }
    // 아래쪽 (y 증가 방향이 아래)
    if (placed.y > free.y) {
      newFreeRects.push({ x: free.x, y: free.y, w: free.w, h: placed.y - free.y })
    }
    // 위쪽
    const bottomEdge = placed.y + placed.h
    const freeBottomEdge = free.y + free.h
    if (bottomEdge < freeBottomEdge) {
      newFreeRects.push({ x: free.x, y: bottomEdge, w: free.w, h: freeBottomEdge - bottomEdge })
    }
  }

  return newFreeRects.filter(r => r.w > 0 && r.h > 0)
}

// 다른 free rect에 완전히 포함된 rect 제거 → 중복 연산 감소
function pruneContained(freeRects: FreeRect[]): FreeRect[] {
  return freeRects.filter((r, i) =>
    !freeRects.some((other, j) =>
      i !== j &&
      other.x <= r.x &&
      other.y <= r.y &&
      other.x + other.w >= r.x + r.w &&
      other.y + other.h >= r.y + r.h
    )
  )
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

  // 면적 큰 순으로 정렬 → 트럭 수 최소화
  expanded.sort((a, b) => b.w * b.h - a.w * a.h)

  const trucks: Placed[][] = []
  let currentTruck: Placed[] = []
  let freeRects: FreeRect[] = [{ x: 0, y: 0, w: binW, h: binH }]

  const fitsBin = (w: number, h: number) => w <= binW && h <= binH

  const startNewTruck = () => {
    if (currentTruck.length) trucks.push(currentTruck)
    currentTruck = []
    freeRects = [{ x: 0, y: 0, w: binW, h: binH }]
  }

  // Best-Short-Side-Fit: 짧은 변의 잔여 공간이 최소인 위치 선택
  const findBestFit = (orientations: Orientation[]) => {
    let bestFit: { x: number; y: number; o: Orientation; score: number } | null = null

    for (const o of orientations) {
      for (const free of freeRects) {
        if (o.packW <= free.w && o.packH <= free.h) {
          const leftoverW = free.w - o.packW
          const leftoverH = free.h - o.packH
          const shortSide = Math.min(leftoverW, leftoverH)
          const longSide = Math.max(leftoverW, leftoverH)
          const score = shortSide * 10000 + longSide

          if (!bestFit || score < bestFit.score) {
            bestFit = { x: free.x, y: free.y, o, score }
          }
        }
      }
    }

    return bestFit
  }

  const makeOrientations = (it: Rect): Orientation[] => {
    if (allowRotate) {
      return [
        { displayW: it.w, displayH: it.h, packW: it.w + margin, packH: it.h + margin, rotated: false },
        { displayW: it.h, displayH: it.w, packW: it.h + margin, packH: it.w + margin, rotated: true },
      ]
    }
    return [{ displayW: it.w, displayH: it.h, packW: it.w + margin, packH: it.h + margin, rotated: false }]
  }

  for (const it of expanded) {
    const orientations = makeOrientations(it)
    const bestFit = findBestFit(orientations)

    if (bestFit) {
      currentTruck.push({
        id: it.id,
        x: bestFit.x,
        y: bestFit.y,
        w: bestFit.o.displayW,
        h: bestFit.o.displayH,
        rotated: bestFit.o.rotated,
        truck: trucks.length
      })
      freeRects = pruneContained(updateFreeRects(freeRects, {
        x: bestFit.x,
        y: bestFit.y,
        w: bestFit.o.packW,
        h: bestFit.o.packH
      }))
    } else {
      startNewTruck()

      const o = orientations.find(o => fitsBin(o.packW, o.packH))
      if (!o) throw new Error(`아이템이 트럭 크기보다 큽니다: ${it.id}`)

      currentTruck.push({
        id: it.id,
        x: 0,
        y: 0,
        w: o.displayW,
        h: o.displayH,
        rotated: o.rotated,
        truck: trucks.length
      })
      freeRects = pruneContained(updateFreeRects(freeRects, { x: 0, y: 0, w: o.packW, h: o.packH }))
    }
  }

  if (currentTruck.length) trucks.push(currentTruck)

  return { trucks, count: trucks.length }
}
