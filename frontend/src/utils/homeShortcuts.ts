// 바로가기 구성은 위젯 배치와 별도로 계정 단위로 저장한다.
export type ShortcutId =
  | 'delivery'
  | 'overtime'
  | 'vendors'
  | 'notices'
  | 'admin'
  | 'noticeCreate'
  | 'profile'

export interface ShortcutSettings {
  order: ShortcutId[]
  hidden: ShortcutId[]
}

export const DEFAULT_SHORTCUT_ORDER: ShortcutId[] = [
  'delivery',
  'overtime',
  'vendors',
  'notices',
  'admin',
  'noticeCreate',
  'profile',
]

const DEFAULT_HIDDEN: ShortcutId[] = ['profile']
const STORAGE_KEY_PREFIX = 'home_shortcuts:'
const KNOWN_IDS = new Set<ShortcutId>(DEFAULT_SHORTCUT_ORDER)

function isShortcutId(value: unknown): value is ShortcutId {
  return typeof value === 'string' && KNOWN_IDS.has(value as ShortcutId)
}

function storageKey(username: string | null): string | null {
  return username ? `${STORAGE_KEY_PREFIX}${encodeURIComponent(username)}` : null
}

function defaults(available: ShortcutId[]): ShortcutSettings {
  return {
    order: DEFAULT_SHORTCUT_ORDER.filter((id) => available.includes(id)),
    hidden: DEFAULT_HIDDEN.filter((id) => available.includes(id)),
  }
}

export function loadShortcutSettings(username: string | null, available: ShortcutId[]): ShortcutSettings {
  const fallback = defaults(available)
  try {
    const key = storageKey(username)
    const raw = key ? localStorage.getItem(key) : null
    if (!raw) return fallback

    const parsed = JSON.parse(raw) as Partial<ShortcutSettings>
    const availableIds = new Set(available)
    const order = Array.isArray(parsed.order)
      ? [...new Set(parsed.order.filter((id): id is ShortcutId => isShortcutId(id) && availableIds.has(id)))]
      : []
    for (const id of fallback.order) {
      if (!order.includes(id)) order.push(id)
    }

    const hidden = Array.isArray(parsed.hidden)
      ? [...new Set(parsed.hidden.filter((id): id is ShortcutId => isShortcutId(id) && availableIds.has(id)))]
      : []
    return { order, hidden }
  } catch {
    return fallback
  }
}

export function saveShortcutSettings(
  settings: ShortcutSettings,
  username: string | null,
): void {
  try {
    const key = storageKey(username)
    if (key) localStorage.setItem(key, JSON.stringify(settings))
  } catch {
    // 저장 실패는 무시 (프라이빗 모드 등)
  }
}

export function toggleShortcut(settings: ShortcutSettings, id: ShortcutId): ShortcutSettings {
  const hidden = settings.hidden.includes(id)
    ? settings.hidden.filter((item) => item !== id)
    : [...settings.hidden, id]
  return { ...settings, hidden }
}

export function moveShortcut(
  settings: ShortcutSettings,
  id: ShortcutId,
  direction: 'up' | 'down',
): ShortcutSettings {
  const order = [...settings.order]
  const index = order.indexOf(id)
  if (index === -1) return settings
  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= order.length) return settings
  ;[order[index], order[target]] = [order[target], order[index]]
  return { ...settings, order }
}
