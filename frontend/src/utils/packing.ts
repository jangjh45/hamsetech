export type Rect = { id: number; w: number; h: number; qty?: number }
export type Placed = Rect & { x: number; y: number; rotated: boolean; truck: number }

export type PackOptions = {
  allowRotate?: boolean
  margin?: number
}

export type PackResult = {
  trucks: Placed[][]
  count: number
}

// 빈 공간을 나타내는 타입
type FreeRect = { x: number; y: number; w: number; h: number }

function expandQuantities(items: Rect[]): Rect[] {
  const expanded: Rect[] = []
  for (const it of items) {
    const q = Math.max(1, it.qty || 1)
    // 큰 값을 세로(h)로, 작은 값을 가로(w)로 정규화
    const normalizedW = Math.min(it.w, it.h)
    const normalizedH = Math.max(it.w, it.h)
    for (let i = 0; i < q; i++) expanded.push({ id: it.id, w: normalizedW, h: normalizedH })
  }
  return expanded
}

// 두 직사각형이 겹치는지 확인
function rectsOverlap(
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number
): boolean {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2
}

// 물품 배치 후 빈 공간을 분할하고 업데이트
function updateFreeRects(
  freeRects: FreeRect[], 
  placed: { x: number; y: number; w: number; h: number }
): FreeRect[] {
  const newFreeRects: FreeRect[] = []

  for (const free of freeRects) {
    // 배치된 물품과 빈 공간이 겹치지 않으면 그대로 유지
    if (!rectsOverlap(free.x, free.y, free.w, free.h, placed.x, placed.y, placed.w, placed.h)) {
      newFreeRects.push(free)
      continue
    }

    // 배치된 물품에 의해 분할되는 새로운 빈 공간 생성
    
    // 왼쪽 빈 공간
    if (placed.x > free.x) {
      const w = placed.x - free.x
      if (w > 0) {
        newFreeRects.push({ x: free.x, y: free.y, w, h: free.h })
      }
    }
    
    // 오른쪽 빈 공간
    const rightEdge = placed.x + placed.w
    const freeRightEdge = free.x + free.w
    if (rightEdge < freeRightEdge) {
      const w = freeRightEdge - rightEdge
      if (w > 0) {
        newFreeRects.push({ x: rightEdge, y: free.y, w, h: free.h })
      }
    }
    
    // 위쪽 빈 공간
    const topEdge = placed.y + placed.h
    const freeTopEdge = free.y + free.h
    if (topEdge < freeTopEdge) {
      const h = freeTopEdge - topEdge
      if (h > 0) {
        newFreeRects.push({ x: free.x, y: topEdge, w: free.w, h })
      }
    }
    
    // 아래쪽 빈 공간
    if (placed.y > free.y) {
      const h = placed.y - free.y
      if (h > 0) {
        newFreeRects.push({ x: free.x, y: free.y, w: free.w, h })
      }
    }
  }

  // 유효한 빈 공간만 필터링 (크기가 0보다 큰 것)
  // 간소화: 포함 관계 체크 없이 모든 빈 공간 유지
  return newFreeRects.filter(r => r.w > 0 && r.h > 0)
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

  // 입력된 물품 목록 순서대로 적재 (정렬 없음)
  
  const trucks: Placed[][] = []
  let currentTruck: Placed[] = []
  let freeRects: FreeRect[] = [{ x: 0, y: 0, w: binW, h: binH }]

  const fitsBin = (w: number, h: number) => w <= binW && h <= binH

  const startNewTruck = () => {
    if (currentTruck.length) trucks.push(currentTruck)
    currentTruck = []
    freeRects = [{ x: 0, y: 0, w: binW, h: binH }]
  }

  // Best Fit: 물품이 들어갈 수 있는 가장 적합한 빈 공간 찾기
  const findBestFit = (orientations: Array<{ w: number; h: number; rotated: boolean }>) => {
    let bestFit: { 
      x: number; 
      y: number; 
      o: { w: number; h: number; rotated: boolean };
      score: number 
    } | null = null

    for (const o of orientations) {
      for (const free of freeRects) {
        // 빈 공간에 물품이 들어가는지 확인
        if (o.w <= free.w && o.h <= free.h) {
          // Best-Short-Side-Fit: 짧은 변의 남는 길이가 최소인 위치 선택
          const leftoverW = free.w - o.w
          const leftoverH = free.h - o.h
          const shortSide = Math.min(leftoverW, leftoverH)
          const longSide = Math.max(leftoverW, leftoverH)
          
          // 점수: 짧은 변 남는 길이 * 1000 + 긴 변 남는 길이
          const score = shortSide * 10000 + longSide
          
          if (!bestFit || score < bestFit.score) {
            bestFit = {
              x: free.x,
              y: free.y,
              o,
              score
            }
          }
        }
      }
    }

    return bestFit
  }

  for (const it of expanded) {
    const orientations = allowRotate
      ? [
          { w: it.w + margin, h: it.h + margin, rotated: false },
          { w: it.h + margin, h: it.w + margin, rotated: true },
        ]
      : [{ w: it.w + margin, h: it.h + margin, rotated: false }]

    // 현재 트럭에서 Best Fit 위치 찾기
    const bestFit = findBestFit(orientations)
    
    if (bestFit) {
      // 물품 배치
      currentTruck.push({
        ...it,
        x: bestFit.x,
        y: bestFit.y,
        w: bestFit.o.w,
        h: bestFit.o.h,
        rotated: bestFit.o.rotated,
        truck: trucks.length
      })
      
      // 빈 공간 업데이트
      freeRects = updateFreeRects(freeRects, { 
        x: bestFit.x, 
        y: bestFit.y, 
        w: bestFit.o.w, 
        h: bestFit.o.h 
      })
    } else {
      // 현재 트럭에 배치 불가 → 새 트럭 생성
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
      
      // 빈 공간 업데이트
      freeRects = updateFreeRects(freeRects, { x: 0, y: 0, w: o.w, h: o.h })
    }
  }

  if (currentTruck.length) trucks.push(currentTruck)

  return { trucks, count: trucks.length }
}
