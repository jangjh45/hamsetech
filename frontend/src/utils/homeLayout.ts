// 메인화면 위젯 레이아웃(순서/숨김) 설정. localStorage에 저장한다.

export type WidgetId =
  | 'clock'
  | 'today'
  | 'overtime'
  | 'calendar'
  | 'todo'
  | 'notices'
  | 'shortcuts'

// 위젯 표시 순서 기본값. 크기(WIDGET_SIZES)와 맞물려 그리드에서
// 컴팩트 3개 → 와이드 2개 → 와이드 2개 세 줄을 만든다.
export const DEFAULT_ORDER: WidgetId[] = [
  'clock',
  'today',
  'overtime',
  'calendar',
  'todo',
  'notices',
  'shortcuts',
]

export const WIDGET_LABELS: Record<WidgetId, string> = {
  clock: '시계',
  today: '오늘 일정',
  overtime: '잔업/특근 요약',
  calendar: '캘린더',
  todo: '할 일',
  notices: '최근 공지사항',
  shortcuts: '바로가기',
}

// 그리드에서 차지하는 폭. compact는 1/3, wide는 1/2 열을 쓴다.
export type WidgetSize = 'compact' | 'wide'

export const WIDGET_SIZES: Record<WidgetId, WidgetSize> = {
  clock: 'compact',
  today: 'compact',
  overtime: 'compact',
  calendar: 'wide',
  todo: 'wide',
  notices: 'wide',
  shortcuts: 'wide',
}

export interface HomeLayout {
  order: WidgetId[]
  hidden: WidgetId[]
}

export const DEFAULT_LAYOUT: HomeLayout = { order: DEFAULT_ORDER, hidden: [] }

const STORAGE_KEY = 'home_widget_layout'

const KNOWN_IDS = new Set<WidgetId>(DEFAULT_ORDER)

function isWidgetId(value: unknown): value is WidgetId {
  return typeof value === 'string' && KNOWN_IDS.has(value as WidgetId)
}

// 저장된 설정을 불러오되, 알 수 없는 id는 버리고 누락된 id는 뒤에 추가해
// 위젯이 추가/삭제되어도 안전하게 동작하도록 기본값과 병합한다.
export function loadLayout(): HomeLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_LAYOUT }
    const parsed = JSON.parse(raw) as Partial<HomeLayout>

    const storedOrder = Array.isArray(parsed.order) ? parsed.order.filter(isWidgetId) : []
    // 저장된 순서 + 기본 순서에만 있는(신규) 위젯을 뒤에 이어붙임
    const order: WidgetId[] = [...storedOrder]
    for (const id of DEFAULT_ORDER) {
      if (!order.includes(id)) order.push(id)
    }

    const hidden = Array.isArray(parsed.hidden) ? parsed.hidden.filter(isWidgetId) : []

    return { order, hidden }
  } catch {
    return { ...DEFAULT_LAYOUT }
  }
}

export function saveLayout(layout: HomeLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch {
    // 저장 실패는 무시 (프라이빗 모드 등)
  }
}

// --- 순수 변형 헬퍼 ---

export function isHidden(layout: HomeLayout, id: WidgetId): boolean {
  return layout.hidden.includes(id)
}

export function toggleHidden(layout: HomeLayout, id: WidgetId): HomeLayout {
  const hidden = layout.hidden.includes(id)
    ? layout.hidden.filter((h) => h !== id)
    : [...layout.hidden, id]
  return { ...layout, hidden }
}

export function moveWidget(layout: HomeLayout, id: WidgetId, direction: 'up' | 'down'): HomeLayout {
  const order = [...layout.order]
  const index = order.indexOf(id)
  if (index === -1) return layout
  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= order.length) return layout
  ;[order[index], order[target]] = [order[target], order[index]]
  return { ...layout, order }
}

// 드래그로 sourceId를 targetId 자리에 끼워 넣는다.
// 아래로 끌면 대상 뒤, 위로 끌면 대상 앞에 놓여 손에 잡히는 대로 움직인다.
export function reorderWidget(
  layout: HomeLayout,
  sourceId: WidgetId,
  targetId: WidgetId,
): HomeLayout {
  if (sourceId === targetId) return layout
  const sourceIndex = layout.order.indexOf(sourceId)
  const targetIndex = layout.order.indexOf(targetId)
  if (sourceIndex === -1 || targetIndex === -1) return layout

  const order = layout.order.filter((id) => id !== sourceId)
  const insertAt = order.indexOf(targetId) + (sourceIndex < targetIndex ? 1 : 0)
  order.splice(insertAt, 0, sourceId)
  return { ...layout, order }
}

export function visibleOrder(layout: HomeLayout): WidgetId[] {
  return layout.order.filter((id) => !layout.hidden.includes(id))
}
