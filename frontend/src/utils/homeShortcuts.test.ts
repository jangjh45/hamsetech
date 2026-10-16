import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SHORTCUT_ORDER,
  loadShortcutSettings,
  moveShortcut,
  saveShortcutSettings,
  toggleShortcut,
  type ShortcutId,
  type ShortcutSettings,
} from './homeShortcuts'

const USER = 'kim'
const OTHER_USER = 'lee'
const STORAGE_KEY = `home_shortcuts:${USER}`
const USER_SHORTCUTS: ShortcutId[] = ['delivery', 'overtime', 'vendors', 'notices', 'profile']

beforeEach(() => localStorage.clear())

describe('home shortcut settings', () => {
  it('기본 설정은 자주 쓰는 메뉴를 보이고 프로필은 중복을 피해 숨긴다', () => {
    const settings = loadShortcutSettings(USER, USER_SHORTCUTS)

    expect(settings.order).toEqual(USER_SHORTCUTS)
    expect(settings.hidden).toEqual(['profile'])
  })

  it('사용자별 설정을 분리한다', () => {
    const settings: ShortcutSettings = {
      order: ['vendors', 'delivery', 'overtime', 'notices', 'profile'],
      hidden: ['profile'],
    }
    saveShortcutSettings(settings, USER)

    expect(loadShortcutSettings(USER, USER_SHORTCUTS)).toEqual(settings)
    expect(loadShortcutSettings(OTHER_USER, USER_SHORTCUTS)).not.toEqual(settings)
  })

  it('저장된 순서를 유지하고 추가된 메뉴는 뒤에 붙이며 사용할 수 없는 메뉴는 뺀다', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      order: ['notices', 'retired-shortcut', 'delivery', 'admin'],
      hidden: ['profile', 'admin'],
    }))

    const settings = loadShortcutSettings(USER, USER_SHORTCUTS)
    expect(settings.order).toEqual(['notices', 'delivery', 'overtime', 'vendors', 'profile'])
    expect(settings.hidden).toEqual(['profile'])
  })

  it('표시 여부와 순서를 불변 방식으로 바꾼다', () => {
    const settings = loadShortcutSettings(USER, USER_SHORTCUTS)
    const shown = toggleShortcut(settings, 'profile')
    const reordered = moveShortcut(shown, 'vendors', 'up')

    expect(shown.hidden).toEqual([])
    expect(reordered.order.slice(1, 3)).toEqual(['vendors', 'overtime'])
    expect(settings.hidden).toEqual(['profile'])
    expect(DEFAULT_SHORTCUT_ORDER).toContain('vendors')
  })
})
