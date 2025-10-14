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

  // 큰 변 길이 기준 내림차순 정렬
  const sorted = [...expanded].sort((a, b) => Math.max(b.h, b.w) - Math.max(a.h, a.w))
  const trucks: Placed[][] = []

  const fitsBin = (w: number, h: number) => w <= binW && h <= binH

  let currentTruck: Placed[] = []
  let shelfY = 0
  let shelfH = 0
  let shelfX = 0

  const finalizeCurrentTruck = () => {
    if (currentTruck.length) trucks.push(currentTruck)
  }

  const startNewTruck = () => {
    finalizeCurrentTruck()
    currentTruck = []
    shelfY = 0
    shelfH = 0
    shelfX = 0
  }

  for (const it of sorted) {
    const orientations = allowRotate
      ? [
          { w: it.w + margin, h: it.h + margin, rotated: false },
          { w: it.h + margin, h: it.w + margin, rotated: true },
        ]
      : [{ w: it.w + margin, h: it.h + margin, rotated: false }]

    let placed = false

    for (const o of orientations) {
      if (shelfH === 0) shelfH = o.h
      if (o.h <= shelfH && shelfX + o.w <= binW && shelfY + o.h <= binH) {
        currentTruck.push({ ...it, x: shelfX, y: shelfY, w: o.w, h: o.h, rotated: o.rotated, truck: trucks.length })
        shelfX += o.w
        placed = true
        break
      }
    }
    if (placed) continue

    for (const o of orientations) {
      const nextShelfY = shelfY + shelfH
      if (nextShelfY + o.h <= binH && o.w <= binW) {
        shelfY = nextShelfY
        shelfH = o.h
        shelfX = 0
        currentTruck.push({ ...it, x: 0, y: shelfY, w: o.w, h: o.h, rotated: o.rotated, truck: trucks.length })
        shelfX += o.w
        placed = true
        break
      }
    }
    if (placed) continue

    // 새 트럭
    startNewTruck()
    const o = orientations.find(o => fitsBin(o.w, o.h))
    if (!o) throw new Error(`아이템이 트럭 크기보다 큽니다: ${it.id}`)
    shelfH = o.h
    shelfX = 0
    shelfY = 0
    currentTruck.push({ ...it, x: 0, y: 0, w: o.w, h: o.h, rotated: o.rotated, truck: trucks.length })
    shelfX += o.w
  }

  finalizeCurrentTruck()

  // 시각화에 깔끔히 보이도록 margin 제거한 실제 w/h를 별도 필드로 둘 수도 있지만, 여기선 그대로 둠
  return { trucks, count: trucks.length }
}


