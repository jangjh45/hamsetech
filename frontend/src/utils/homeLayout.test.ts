import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_LAYOUT,
  DEFAULT_ORDER,
  WIDGET_LABELS,
  WIDGET_SIZES,
  canImportLegacyLayout,
  importLegacyLayout,
  isHidden,
  loadLayout,
  moveWidget,
  reorderWidget,
  saveLayout,
  toggleHidden,
  visibleOrder,
  type HomeLayout,
  type WidgetId,
} from './homeLayout'

const USERNAME = 'kim'
const STORAGE_KEY = `home_widget_layout:${USERNAME}`
const LEGACY_STORAGE_KEY = 'home_widget_layout'

function writeStorage(value: unknown): void {
  localStorage.setItem(STORAGE_KEY, typeof value === 'string' ? value : JSON.stringify(value))
}

beforeEach(() => {
  localStorage.clear()
})

describe('loadLayout — 저장된 설정 복원', () => {
  it('아무것도 없으면 기본 배치를 준다', () => {
    expect(loadLayout(USERNAME)).toEqual(DEFAULT_LAYOUT)
  })

  it('저장된 순서를 그대로 되살린다', () => {
    writeStorage({ order: ['notices', 'clock', 'today', 'calendar', 'todo', 'overtime', 'shortcuts'], hidden: ['clock'] })

    const layout = loadLayout(USERNAME)
    expect(layout.order[0]).toBe('notices')
    expect(layout.hidden).toEqual(['clock'])
  })

  it('알 수 없는 id는 버린다', () => {
    writeStorage({ order: ['clock', 'retired-widget', 'today'], hidden: ['gone-widget'] })

    const layout = loadLayout(USERNAME)
    expect(layout.order).not.toContain('retired-widget' as never)
    expect(layout.hidden).not.toContain('gone-widget' as never)
  })

  it('저장되지 않았던 새 위젯을 뒤에 이어 붙인다', () => {
    // 위젯을 새로 추가하면 옛 사용자 설정에는 그 id가 없다. 빠뜨리면 화면에서
    // 통째로 사라진 것처럼 보이므로 기본 순서에서 채워 넣는다.
    writeStorage({ order: ['notices'], hidden: [] })

    const layout = loadLayout(USERNAME)
    expect(layout.order).toHaveLength(DEFAULT_ORDER.length)
    expect(layout.order[0]).toBe('notices')
    for (const id of DEFAULT_ORDER) expect(layout.order).toContain(id)
  })

  it('중복된 id는 한 번만 남긴다', () => {
    writeStorage({ order: ['clock', 'clock', 'today'], hidden: [] })
    expect(loadLayout(USERNAME).order.filter((id) => id === 'clock')).toHaveLength(1)
  })

  it('숨김 목록도 기본과 합쳐 살아 있는 위젯만 남긴다', () => {
    writeStorage({ order: ['clock'], hidden: ['unknown', 'todo'] })

    const layout = loadLayout(USERNAME)
    expect(layout.hidden).toEqual(['todo'])
  })

  it('깨진 JSON이어도 기본값으로 돌아간다', () => {
    writeStorage('{not json')
    expect(loadLayout(USERNAME)).toEqual(DEFAULT_LAYOUT)
  })

  it('order가 배열이 아니어도 기본값으로 돌아간다', () => {
    writeStorage({ order: 'clock', hidden: 'todo' })
    expect(loadLayout(USERNAME)).toEqual(DEFAULT_LAYOUT)
  })

  it('hidden이 배열이 아니면 숨김 없는 상태로 본다', () => {
    writeStorage({ order: ['clock'], hidden: 'todo' })
    expect(loadLayout(USERNAME).hidden).toEqual([])
  })
})

describe('saveLayout', () => {
  it('저장한 값을 다시 읽으면 같다', () => {
    // 기본 위젯을 전부 포함한 순서여야 한다. 빠진 위젯은 복원하면서 뒤에
    // 이어 붙이는 계약이 있으므로, 일부만 저장하면 왕복 후 배열이 길어진다.
    const layout: HomeLayout = {
      order: ['todo', 'clock', ...DEFAULT_ORDER.filter((id) => id !== 'todo' && id !== 'clock')],
      hidden: ['clock'],
    }
    saveLayout(layout, USERNAME)
    expect(loadLayout(USERNAME)).toEqual(layout)
  })

  it('저장 실패(프라이빗 모드)는 예외를 던지지 않는다', () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => { throw new Error('QuotaExceeded') }
    try {
      expect(() => saveLayout(DEFAULT_LAYOUT, USERNAME)).not.toThrow()
    } finally {
      Storage.prototype.setItem = original
    }
  })

  it('계정별로 레이아웃을 분리하고 공용 설정은 자동으로 읽지 않는다', () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ order: ['todo', 'clock'], hidden: ['notices'] }))
    expect(loadLayout('lee')).toEqual(DEFAULT_LAYOUT)
    saveLayout({ order: ['notices', ...DEFAULT_ORDER.filter((id) => id !== 'notices')], hidden: [] }, 'lee')

    expect(loadLayout('lee').order[0]).toBe('notices')
    expect(loadLayout(USERNAME)).toEqual(DEFAULT_LAYOUT)
    expect(canImportLegacyLayout(USERNAME)).toBe(true)
  })

  it('공용 기기 설정은 계정에서 명시적으로 가져올 수 있다', () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ order: ['todo', 'clock'], hidden: ['notices'] }))
    expect(canImportLegacyLayout(USERNAME)).toBe(true)

    const imported = importLegacyLayout(USERNAME)
    expect(imported?.order.slice(0, 2)).toEqual(['todo', 'clock'])
    expect(imported?.hidden).toEqual(['notices'])
    expect(loadLayout(USERNAME)).toEqual(imported)
    expect(canImportLegacyLayout(USERNAME)).toBe(false)
    expect(canImportLegacyLayout('lee')).toBe(true)
  })

  it('계정 정보가 없으면 레이아웃을 공유 저장하지 않는다', () => {
    saveLayout({ order: ['todo', ...DEFAULT_ORDER.filter((id) => id !== 'todo')], hidden: [] }, null)
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull()
    expect(loadLayout(null)).toEqual(DEFAULT_LAYOUT)
  })

  it('손상된 공용 설정은 가져오기 대상으로 제안하지 않는다', () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, '{invalid json')
    expect(canImportLegacyLayout(USERNAME)).toBe(false)
    expect(importLegacyLayout(USERNAME)).toBeNull()
  })
})

describe('isHidden', () => {
  it('숨김 목록에 있으면 숨겨져 있다', () => {
    expect(isHidden({ order: DEFAULT_ORDER, hidden: ['todo'] }, 'todo')).toBe(true)
    expect(isHidden({ order: DEFAULT_ORDER, hidden: ['todo'] }, 'clock')).toBe(false)
  })
})

describe('toggleHidden', () => {
  it('숨김 목록에 없으면 추가한다', () => {
    expect(toggleHidden(DEFAULT_LAYOUT, 'todo').hidden).toEqual(['todo'])
  })

  it('이미 숨겼으면 되살린다', () => {
    const hidden: HomeLayout = { order: DEFAULT_ORDER, hidden: ['todo'] }
    expect(toggleHidden(hidden, 'todo').hidden).toEqual([])
  })

  it('원본을 고치지 않는다', () => {
    const original: HomeLayout = { order: DEFAULT_ORDER, hidden: [] }
    toggleHidden(original, 'todo')
    expect(original.hidden).toEqual([])
  })
})

// 실제 위젯 id를 쓴다. 정적인 네 글자 배열로 대체하려 하면 'never' 캐스팅이
// 필요해지고, 그 캐스팅이 moveWidget/reorderWidget의 인자 타입 검사까지
// 함께 무력화해 버린다. 알고리즘은 id 값과 무관하므로 진짜 id로도 된다.
const layout3: HomeLayout = { order: ['clock', 'today', 'todo'], hidden: [] }

describe('moveWidget', () => {
  const layout = layout3

  it('위를 향하면 바로 앞과 자리를 바꾼다', () => {
    expect(moveWidget(layout, 'todo', 'up').order).toEqual(['clock', 'todo', 'today'])
  })

  it('아래를 향하면 바로 뒤와 자리를 바꾼다', () => {
    expect(moveWidget(layout, 'clock', 'down').order).toEqual(['today', 'clock', 'todo'])
  })

  it('이미 첫 번째면 위로 못 움직인다', () => {
    expect(moveWidget(layout, 'clock', 'up').order).toEqual(['clock', 'today', 'todo'])
  })

  it('이미 마지막이면 아래로 못 움직인다', () => {
    expect(moveWidget(layout, 'todo', 'down').order).toEqual(['clock', 'today', 'todo'])
  })

  it('배치에 없는 id면 그대로 둔다', () => {
    // 삭제된 위젯 id가 남아 있을 수 있다. 화면이 깨지지 않아야 한다.
    const result = moveWidget(layout, 'notices', 'up')
    expect(result.order).toEqual(['clock', 'today', 'todo'])
  })

  it('결과는 새 객체고 원본 순서는 그대로다', () => {
    const result = moveWidget(layout, 'clock', 'down')
    expect(result).not.toBe(layout)
    expect(layout.order).toEqual(['clock', 'today', 'todo'])
  })
})

const layout4: HomeLayout = { order: ['clock', 'today', 'todo', 'notices'], hidden: [] }

describe('reorderWidget', () => {
  const layout = layout4

  it('아래로 끌어다 놓으면 대상 뒤에 놓인다', () => {
    expect(reorderWidget(layout, 'clock', 'todo').order).toEqual(['today', 'todo', 'clock', 'notices'])
  })

  it('위로 끌어다 놓으면 대상 앞에 놓인다', () => {
    expect(reorderWidget(layout, 'notices', 'today').order).toEqual(['clock', 'notices', 'today', 'todo'])
  })

  it('인접한 두 위젯을 바꾸면 순서가 뒤집힌다', () => {
    expect(reorderWidget(layout, 'clock', 'today').order).toEqual(['today', 'clock', 'todo', 'notices'])
  })

  it('자기자신이면 그대로 둔다', () => {
    expect(reorderWidget(layout, 'today', 'today').order).toEqual(['clock', 'today', 'todo', 'notices'])
  })

  it('없는 id면 그대로 둔다', () => {
    expect(reorderWidget(layout, 'calendar', 'today').order).toEqual(['clock', 'today', 'todo', 'notices'])
    expect(reorderWidget(layout, 'clock', 'calendar').order).toEqual(['clock', 'today', 'todo', 'notices'])
  })

  it('결과에 중복이 생기지 않는다', () => {
    const result = reorderWidget(layout, 'clock', 'notices')
    expect(result.order).toHaveLength(4)
    expect(new Set(result.order).size).toBe(4)
  })

  it('결과에 빠지는 위젯이 없다', () => {
    const result = reorderWidget(layout, 'clock', 'notices')
    for (const id of layout.order) expect(result.order).toContain(id)
  })

  it('원본을 고치지 않는다', () => {
    reorderWidget(layout, 'clock', 'notices')
    expect(layout.order).toEqual(['clock', 'today', 'todo', 'notices'])
  })
})

describe('visibleOrder', () => {
  it('숨김 위젯을 빼고 순서를 지킨다', () => {
    const layout = { order: ['clock', 'today', 'todo'] as never, hidden: ['today'] as never }
    expect(visibleOrder(layout)).toEqual(['clock', 'todo'])
  })

  it('전부 숨겼으면 빈 배열이다', () => {
    expect(visibleOrder({ order: DEFAULT_ORDER, hidden: [...DEFAULT_ORDER] })).toEqual([])
  })

  it('아무것도 숨기지 않았으면 전체 순서다', () => {
    expect(visibleOrder(DEFAULT_LAYOUT)).toEqual(DEFAULT_ORDER)
  })
})

describe('기본값 자체의 계약', () => {
  it('모든 위젯에 크기가 정해져 있다', () => {
    // 크기가 없으면 그리드에서 폭을 정할 수 없어 레이아웃이 깨진다.
    for (const id of DEFAULT_ORDER) {
      expect(WIDGET_SIZES[id], `${id} 에 크기가 없다`).toBeDefined()
    }
  })

  it('기본 순서에 중복이 없다', () => {
    expect(new Set(DEFAULT_ORDER).size).toBe(DEFAULT_ORDER.length)
  })

  it('기본 배치는 아무것도 숨기지 않는다', () => {
    expect(DEFAULT_LAYOUT.hidden).toEqual([])
  })

  it('WIDGET_SIZES에 기본 순서에 없는 위젯이 없다', () => {
    // 크기 맵에 남은 유령 항목은 되지만 않는다.
    for (const id of Object.keys(WIDGET_SIZES)) {
      expect(DEFAULT_ORDER, `${id} 는 기본 순서에 없다`).toContain(id as WidgetId)
    }
  })

  it('위젯 라벨이 빠지지 않는다', () => {
    for (const id of DEFAULT_ORDER) {
      expect(WIDGET_LABELS[id], `${id} 에 라벨이 없다`).toBeTruthy()
    }
  })
})
