/*
 * 적재(패킹) 화면에서 하위 컴포넌트가 함께 쓰는 상수·헬퍼.
 *
 * Delivery.tsx가 1400줄을 넘겨 트럭 그림·카드·시나리오 행을 pages/ 밖으로
 * 꺼냈다. 상수·헬퍼도 이 파일로 옮겨 두 파일이 같은 값을 쓰게 했다.
 *
 * 색에 대한 주의: 아래 colorPalette 는 이 프로젝트에서 테마 토큰(--fl-* 등)을
 * 쓰지 않는 유일한 색이다. 같은 물품은 라이트/다크에서 같은 색이어야 알아볼 수
 * 있으므로 여기서 값을 정한다.
 */

export type ItemRow = { id: number; name: string; w: string; h: string; qty: string }

/** 물품 구분색. 테마 토큰을 쓰지 않는 유일한 색. */
export const colorPalette = [
  { fill: '#3b82f6', stroke: '#1d4ed8', text: '#ffffff' },
  { fill: '#10b981', stroke: '#047857', text: '#ffffff' },
  { fill: '#f59e0b', stroke: '#b45309', text: '#ffffff' },
  { fill: '#ef4444', stroke: '#b91c1c', text: '#ffffff' },
  { fill: '#8b5cf6', stroke: '#6d28d9', text: '#ffffff' },
  { fill: '#06b6d4', stroke: '#0e7490', text: '#ffffff' },
  { fill: '#84cc16', stroke: '#4d7c0f', text: '#ffffff' },
  { fill: '#f97316', stroke: '#c2410c', text: '#ffffff' },
  { fill: '#ec4899', stroke: '#be185d', text: '#ffffff' },
  { fill: '#64748b', stroke: '#334155', text: '#ffffff' },
]

export const getItemColor = (id: number) => colorPalette[id % colorPalette.length]

/**
 * 적재함 프리셋 (차량 적재함 내측 치수).
 *
 * 5톤 장축은 현장에서 쓰는 실제 값을 받은 것이고, 나머지 세 개는 차종·제조사·
 * 바디 종류마다 달라 대표값을 넣어둔 것이다. (확인 필요)
 */
export const BIN_PRESETS = [
  { label: '1톤 카고', w: 2830, h: 1630 },
  { label: '2.5톤 카고', w: 4300, h: 1850 },
  { label: '5톤 카고', w: 6200, h: 2300 },
  { label: '5톤 장축', w: 7400, h: 2200 },
]

/** 한 번에 그리는 트럭 수. 결과가 수백 대여도 화면이 버티게 한다. */
export const TRUCK_PAGE = 20

export const DRAFT_KEY = 'delivery_draft_v1'

/** 적재함 그림이 넘지 않을 크기 (px). 세로로 쌓으니 한 대가 화면을 다 먹으면 안 된다. */
export const FIGURE_MAX_W = 900
export const FIGURE_MAX_H = 560

/** 적재율 구간 → CSS 톤 클래스 (숫자와 막대가 같은 색을 쓰도록) */
export function rateTone(util: number): string {
  if (util >= 80) return 'dl-tone-good'
  if (util >= 50) return 'dl-tone-mid'
  return 'dl-tone-low'
}

export function normalizeNumericInput(value: string): string {
  const digits = value.replace(/[^0-9]/g, '')
  if (digits === '') return ''
  return String(parseInt(digits, 10)) // 선행 0 제거
}

export function toInt(value: string): number {
  const n = parseInt(value || '0', 10)
  return Number.isNaN(n) ? 0 : n
}

/** mm² → m². 적재함은 mm 단위로 입력받지만 면적은 m²로 읽는 게 자연스럽다. */
export function toSquareMeters(mm2: number): string {
  return (mm2 / 1_000_000).toFixed(2)
}

/**
 * 적재함 비율에 맞춘 그림 폭.
 * 세로로 긴 적재함은 폭을 줄여야 높이가 FIGURE_MAX_H 안에 들어온다.
 */
export function figureWidth(binW: number, binH: number): string {
  if (binW <= 0 || binH <= 0) return '100%'
  const widthAtMaxHeight = Math.round((FIGURE_MAX_H * binW) / binH)
  return `min(100%, ${Math.min(FIGURE_MAX_W, widthAtMaxHeight)}px)`
}

// ── 임시저장 ─────────────────────────────────────────────────

export interface Draft {
  binW: string
  binH: string
  margin: string
  allowRotate: boolean
  preserveOrder: boolean
  items: ItemRow[]
}

/** 새로고침으로 입력이 날아가지 않게 브라우저에 남겨둔 초안 */
export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw) as Draft
    // 저장 형식이 바뀌었거나 손상된 값은 조용히 버린다
    if (!Array.isArray(draft.items)) return null
    return draft
  } catch {
    return null
  }
}