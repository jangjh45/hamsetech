import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 레거시 CSS가 되살아나는 것을 막는다.
 *
 * 리치 텍스트 이전의 Vite 스타터 유산(클래스 28개, 색 토큰 17개)을 2026-10에 걷어
 * 냈다. 지운 뒤 다시 생기면 화면이 조용히 깨진다 — 이미 대안 이름(fl-/nt-)을 쓰는
 * 화면이 많아서 "이 클래스를 되살리면 되겠지"라는 유혹이 생긴다.
 *
 * 문법 검사는 PostCSS나 빌드로 이미 이뤄지므로 여기서는 존재 여부만 본다.
 */
const stylesDir = join(process.cwd(), 'src', 'styles')

function cssFiles(): string[] {
  return readdirSync(stylesDir).filter((f: string) => f.endsWith('.css'))
}

function read(file: string): string {
  return readFileSync(join(stylesDir, file), 'utf8')
}

describe('레거시 CSS가 지워진 상태로 유지된다', () => {
  it('지운 파일이 되살아나지 않는다', () => {
    expect(cssFiles()).not.toContain('ui.css')
  })

  it('기반 규칙 파일이 있다', () => {
    expect(cssFiles()).toContain('base.css')
  })

  it('기반 규칙에 필요한 것만 남았다', () => {
    const css = read('base.css')
    // 루트 높이는 앱이 화면을 채우는 근거다. 이게 없으면 높이를 자꾸 계산해야 한다.
    expect(css).toMatch(/html,\s*body,\s*#root\s*\{[^}]*height:\s*100%/)
    expect(css).toMatch(/body\s*\{[^}]*margin:\s*0/)
    expect(css).toContain('font-family')
  })

  it('전역 배경색을 두지 않는다', () => {
    // 예전엔 여기서 그라데이션을 깔고 각 화면이 body:has()로 덮어썼다. 화면 하나
    // 빠뜨리면 그대로 보이는 구조였다. 이제는 각 CSS가 자기 배경을 정한다.
    const css = read('base.css')
    const bodyRule = css.match(/\nbody\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(bodyRule).not.toMatch(/background/)
    expect(bodyRule).not.toMatch(/color\s*:/)
  })

  it('모든 화면이 배경을 직접 정할 수 있는 래퍼를 감싼다', () => {
    // base.css에 배경이 없으므로, 배경 없는 화면이 있으면 흰 배경이 그대로 보인다.
    const dashboard = read('dashboard.css')
    const auth = read('auth.css')
    expect(dashboard).toMatch(/body:has\(\.fl-page\)/)
    expect(auth).toMatch(/body:has\(\.au-shell\)/)
  })
})

describe('지운 레거시 클래스가 다시 쓰이지 않는다', () => {
  /** 지운 클래스. 이름이 잘못 있으면 회귀를 못 잡는다. */
  const LEGACY = [
    'container', 'navbar', 'spacer', 'panel', 'card', 'title', 'subtitle', 'meta',
    'link-plain', 'form', 'field', 'label', 'input', 'input-event', 'btn',
    'btn-create', 'btn-edit', 'btn-delete', 'btn-submit', 'ghost', 'btn-add-event',
    'event-item', 'todo-item', 'btn-delete-event', 'error', 'grid', 'center',
    'priority-button-group', 'priority-button',
  ]

  /** 컴포넌트 마크업에서 실제로 쓰는 클래스 토큰을 뽑는다. */
  function usedClasses(): Map<string, string[]> {
    const found = new Map<string, string[]>()
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(path)
        } else if (/\.tsx?$/.test(entry.name)) {
          const src = readFileSync(path, 'utf8')
          for (const m of src.matchAll(/className\s*=\s*["'`]([^"'`]*)["'`]/g)) {
            for (const token of m[1].split(/\s+/).filter(Boolean)) {
              if (!found.has(token)) found.set(token, [])
              found.get(token)!.push(entry.name)
            }
          }
        }
      }
    }
    walk(join(process.cwd(), 'src'))
    return found
  }

  it('tsx에서 레거시 클래스 토큰을 쓰지 않는다', () => {
    const used = usedClasses()
    const offenders = LEGACY.filter((name) => used.has(name)).map(
      (name) => `${name} (${used.get(name)!.join(', ')})`,
    )
    expect(offenders).toEqual([])
  })

  it('CSS가 레거시 클래스를 정의하지 않는다', () => {
    // 정의가 있으면 어딘가에서 쓰이는 것이다. 사용처가 없으면 순전한 사문화다.
    const offenders: string[] = []
    for (const file of cssFiles()) {
      const css = read(file)
      for (const name of LEGACY) {
        // 접두사 없는 .name 만. .fl-card 가 .card 로 걸리는 것을 막는다.
        if (new RegExp(`(?<![-\\w.])\\.${name}(?![-\\w])`).test(css)) {
          offenders.push(`${file}: .${name}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('레거시 색 토큰을 쓰지 않는다', () => {
    // --panel / --text / --primary 같은 이름은 --fl-* 로만 존재한다. 전역 토큰이
    // 남아 있으면 어떤 CSS가 그 옛 토큰을 물고 있는지 찾기 어렵다.
    const LEGACY_VARS = [
      'bg', 'panel', 'text', 'muted', 'primary', 'primary-600', 'border', 'danger',
      'danger-bg', 'accent-bg', 'accent-text', 'input-bg', 'header-h', 'glow',
      'glow-danger', 'glass-specular', 'card-hover-bg',
    ]
    const offenders: string[] = []
    for (const file of cssFiles()) {
      const css = read(file)
      for (const name of LEGACY_VARS) {
        if (new RegExp(`var\\(--${name}\\)`).test(css)) offenders.push(`${file}: --${name}`)
      }
    }
    expect(offenders).toEqual([])
  })
})