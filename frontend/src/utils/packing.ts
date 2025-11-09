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

  // 개선된 정렬: 물품의 효율성을 고려한 정렬 (면적 + 둘레 길이)
  const sorted = [...expanded].sort((a, b) => {
    const areaA = a.w * a.h
    const areaB = b.w * b.h
    const perimeterA = 2 * (a.w + a.h)
    const perimeterB = 2 * (b.w + b.h)

    // 1. 면적이 큰 순서
    if (areaA !== areaB) return areaB - areaA
    // 2. 둘레 길이가 긴 순서 (더 복잡한 형태 우선)
    if (perimeterA !== perimeterB) return perimeterB - perimeterA
    // 3. 긴 변이 긴 순서
    return Math.max(b.h, b.w) - Math.max(a.h, a.w)
  })
  
  const trucks: Placed[][] = []

  let currentTruck: Placed[] = []

  const fitsBin = (w: number, h: number) => w <= binW && h <= binH

  const startNewTruck = () => {
    if (currentTruck.length) trucks.push(currentTruck)
    currentTruck = []
  }

  // 트럭에 물품을 배치할 수 있는 위치를 찾기 - 최적화된 버전
  const findBestPosition = (orientations: Array<{ w: number; h: number; rotated: boolean }>) => {
    let bestPos: { x: number; y: number; o: { w: number; h: number; rotated: boolean } } | null = null
    let bestScore = -1 // 더 높은 점수가 더 좋은 위치

    // 그리드 크기 (큰 물품일수록 큰 그리드 사용)
    const getGridSize = (itemSize: number) => Math.max(1, Math.min(20, Math.floor(itemSize / 10)))

    for (const o of orientations) {
      const gridSize = getGridSize(Math.max(o.w, o.h))

      // Bottom-Left Fill: 아래쪽과 왼쪽부터 채우는 전략
      for (let y = 0; y <= binH - o.h; y += gridSize) {
        for (let x = 0; x <= binW - o.w; x += gridSize) {
          // 배치 가능한 위치인지 확인 - 최적화된 충돌 검사
          let canPlace = true
          for (const placed of currentTruck) {
            // 빠른 사전 검사: 바운딩 박스 겹침 확인
            if (x < placed.x + placed.w && x + o.w > placed.x &&
                y < placed.y + placed.h && y + o.h > placed.y) {
              // 정밀 충돌 검사
              if (rectsIntersect(x, y, o.w, o.h, placed.x, placed.y, placed.w, placed.h)) {
                canPlace = false
                break
              }
            }
          }

          if (canPlace) {
            // 점수 계산: 아래쪽 우선, 그 다음 왼쪽 우선 (Bottom-Left Fill)
            const score = (binH - y - o.h) * 1000 + (binW - x - o.w)
            if (score > bestScore) {
              bestScore = score
              bestPos = { x, y, o }
            }
          }
        }
      }

      // 그리드 검색으로 찾지 못했다면 정밀 검색 (1픽셀 단위)
      if (!bestPos && gridSize > 1) {
        for (let y = 0; y <= binH - o.h; y += 1) {
          for (let x = 0; x <= binW - o.w; x += 1) {
            let canPlace = true
            for (const placed of currentTruck) {
              // 빠른 사전 검사: 바운딩 박스 겹침 확인
              if (x < placed.x + placed.w && x + o.w > placed.x &&
                  y < placed.y + placed.h && y + o.h > placed.y) {
                // 정밀 충돌 검사
                if (rectsIntersect(x, y, o.w, o.h, placed.x, placed.y, placed.w, placed.h)) {
                  canPlace = false
                  break
                }
              }
            }

            if (canPlace) {
              const score = (binH - y - o.h) * 1000 + (binW - x - o.w)
              if (score > bestScore) {
                bestScore = score
                bestPos = { x, y, o }
              }
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


