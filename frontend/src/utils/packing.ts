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
  /** 입력 순서대로 먼저 싣는다. 기본값(false)은 면적 큰 순으로 자동 정렬. */
  preserveOrder?: boolean
}

export type PackResult = {
  trucks: Placed[][]
  count: number
  /** 적재함보다 커서 어느 트럭에도 넣지 못한 물품 id */
  unplaceable: number[]
  /** 조각 수가 MAX_PIECES를 넘어 계산을 포기했는지 */
  aborted: boolean
  /** 수량까지 펼친 총 조각 수 */
  pieceCount: number
}

/**
 * 계산을 시도할 조각 수 상한.
 *
 * 계산 자체는 이 정도까지 100ms 안쪽이지만, 결과로 나온 트럭을 전부 SVG로
 * 그리는 쪽이 먼저 죽는다. 수량에 0을 하나 더 붙이는 실수로 탭이 멈추지
 * 않도록 막는다.
 */
export const MAX_PIECES = 2000

type FreeRect = { x: number; y: number; w: number; h: number }

type Orientation = {
  displayW: number
  displayH: number
  packW: number   // 마진 포함 패킹용 너비
  packH: number   // 마진 포함 패킹용 높이
  rotated: boolean
}

/** 아직 물품을 더 받을 수 있는 트럭. 트럭마다 자기 빈 공간을 들고 있다. */
type OpenTruck = { items: Placed[]; free: FreeRect[] }

function expandQuantities(items: Rect[]): Rect[] {
  const expanded: Rect[] = []
  for (const it of items) {
    // 치수나 수량이 비어 있는 행은 아직 입력 중인 것으로 보고 건너뛴다.
    // (예전엔 qty 0을 1로 올려서 0×0짜리 유령 물품이 결과에 섞였다)
    if (it.w <= 0 || it.h <= 0) continue
    const q = it.qty ?? 1
    if (q <= 0) continue
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

function makeOrientations(it: Rect, allowRotate: boolean, margin: number): Orientation[] {
  const upright: Orientation = {
    displayW: it.w, displayH: it.h,
    packW: it.w + margin, packH: it.h + margin,
    rotated: false,
  }
  if (!allowRotate) return [upright]
  return [
    upright,
    {
      displayW: it.h, displayH: it.w,
      packW: it.h + margin, packH: it.w + margin,
      rotated: true,
    },
  ]
}

/**
 * 빈 적재함에 놓을 첫 물품의 방향을 고른다.
 *
 * 첫 물품의 방향이 그 트럭의 빈 공간 모양을 결정해서 트럭 수에 크게 영향을
 * 준다. 그 방향으로 격자처럼 쭉 채웠을 때 몇 개가 들어가는지로 고른다.
 *
 * 무작위 600케이스 + 실제 입력 3케이스로 네 가지 방법(이 방법 / 빈 칸에도
 * best-short-side-fit / 들어가는 첫 방향 / 자투리 면적 타이브레이크)을 비교했을 때
 * 이게 가장 좋았다. 옛 방식 대비 12케이스 개선, 1케이스 악화.
 */
function chooseSeedOrientation(
  orientations: Orientation[],
  packBinW: number,
  packBinH: number,
): Orientation | null {
  let best: Orientation | null = null
  let bestCapacity = -1

  for (const o of orientations) {
    if (o.packW > packBinW || o.packH > packBinH) continue
    const capacity = Math.floor(packBinW / o.packW) * Math.floor(packBinH / o.packH)
    if (capacity > bestCapacity) {
      bestCapacity = capacity
      best = o
    }
  }

  return best
}

// Best-Short-Side-Fit: 짧은 변의 잔여 공간이 최소인 위치 선택
function findBestFit(freeRects: FreeRect[], orientations: Orientation[]) {
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

/**
 * 물품을 적재함 여러 대에 나눠 배치한다.
 *
 * 물품 하나마다 이미 연 트럭을 앞에서부터 훑어 처음 들어가는 자리에 넣는다
 * (First-Fit). 예전엔 현재 트럭이 꽉 차면 그 트럭을 영구히 닫아버려서
 * (Next-Fit) 앞 트럭에 남은 공간이 그대로 버려졌다.
 */
export function packIntoTrucks(
  items: Rect[],
  binW: number,
  binH: number,
  options: PackOptions = {}
): PackResult {
  const allowRotate = options.allowRotate ?? true
  const margin = options.margin ?? 0
  const preserveOrder = options.preserveOrder ?? false

  if (binW <= 0 || binH <= 0) throw new Error('Invalid truck size')

  /*
   * 마진은 물품 사이 간격이지 벽면 여백이 아니다. 물품마다 오른쪽·아래에
   * 마진을 붙여 패킹하되 적재함을 그만큼 키우면, 벽에 닿는 물품의 바깥쪽
   * 마진은 늘린 폭이 흡수한다. 예전엔 이 보정이 없어서 적재함 폭과 똑같은
   * 물품이 마진만 주면 "트럭보다 크다"며 실패했다.
   */
  const packBinW = binW + margin
  const packBinH = binH + margin

  const expanded = expandQuantities(items)

  if (expanded.length > MAX_PIECES) {
    return { trucks: [], count: 0, unplaceable: [], aborted: true, pieceCount: expanded.length }
  }

  if (!preserveOrder) {
    // 면적 큰 순으로 넣어야 큰 물품이 자리를 못 잡는 일이 줄어든다
    expanded.sort((a, b) => b.w * b.h - a.w * a.h)
  }

  const trucks: OpenTruck[] = []
  const unplaceable = new Set<number>()

  for (const it of expanded) {
    const orientations = makeOrientations(it, allowRotate, margin)

    let placed = false
    for (let t = 0; t < trucks.length; t++) {
      const fit = findBestFit(trucks[t].free, orientations)
      if (!fit) continue

      trucks[t].items.push({
        id: it.id,
        x: fit.x,
        y: fit.y,
        w: fit.o.displayW,
        h: fit.o.displayH,
        rotated: fit.o.rotated,
        truck: t,
      })
      trucks[t].free = pruneContained(updateFreeRects(trucks[t].free, {
        x: fit.x,
        y: fit.y,
        w: fit.o.packW,
        h: fit.o.packH,
      }))
      placed = true
      break
    }

    if (placed) continue

    // 어느 트럭에도 안 들어가면 새 트럭에 첫 물품으로 놓는다.
    // 빈 적재함에도 안 들어가면 적재함보다 큰 물품이라 건너뛴다.
    const o = chooseSeedOrientation(orientations, packBinW, packBinH)
    if (!o) {
      unplaceable.add(it.id)
      continue
    }

    const index = trucks.length
    trucks.push({
      items: [{
        id: it.id,
        x: 0,
        y: 0,
        w: o.displayW,
        h: o.displayH,
        rotated: o.rotated,
        truck: index,
      }],
      free: pruneContained(updateFreeRects(
        [{ x: 0, y: 0, w: packBinW, h: packBinH }],
        { x: 0, y: 0, w: o.packW, h: o.packH },
      )),
    })
  }

  return {
    trucks: trucks.map(t => t.items),
    count: trucks.length,
    unplaceable: [...unplaceable],
    aborted: false,
    pieceCount: expanded.length,
  }
}
