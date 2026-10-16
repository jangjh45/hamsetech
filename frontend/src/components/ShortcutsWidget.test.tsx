import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ShortcutsWidget from './ShortcutsWidget'

const auth = vi.hoisted(() => ({ admin: false }))
vi.mock('../auth/token', () => ({
  getUsername: () => 'kim',
  isAdmin: () => auth.admin,
}))

describe('ShortcutsWidget', () => {
  beforeEach(() => {
    localStorage.clear()
    auth.admin = false
  })

  afterEach(() => cleanup())

  it('승인 대기 숫자에서 바로 대기 필터로 이동하고 사용자가 메뉴를 편집할 수 있다', () => {
    render(<MemoryRouter><ShortcutsWidget pendingCount={3} /></MemoryRouter>)

    const overtimeLink = screen.getByRole('link', { name: /잔업 등록/ })
    expect(overtimeLink.getAttribute('href')).toBe('/overtime?status=PENDING')
    expect(screen.getByRole('link', { name: /업체 주소록/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /공지사항/ })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /내 정보/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '편집' }))
    const profileToggle = screen.getByRole('checkbox', { name: '내 정보' }) as HTMLInputElement
    expect(profileToggle.checked).toBe(false)
    fireEvent.click(profileToggle)
    expect(screen.getByRole('link', { name: /내 정보/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '업체 주소록 위로 이동' }))
    const tileTitles = [...document.querySelectorAll('.fl-tile-title')].map((node) => node.textContent)
    expect(tileTitles.indexOf('업체 주소록')).toBeLessThan(tileTitles.indexOf('잔업 등록'))
    expect(within(screen.getByRole('group', { name: '바로가기 설정' })).getByText('업체 주소록')).toBeTruthy()
  })

  it('관리자 바로가기는 관리자에게만 보여준다', () => {
    auth.admin = true
    render(<MemoryRouter><ShortcutsWidget pendingCount={0} /></MemoryRouter>)

    expect(screen.getByRole('link', { name: /관리자/ }).getAttribute('href')).toBe('/admin')
    expect(screen.getByRole('link', { name: /공지 작성/ }).getAttribute('href')).toBe('/notice/new')
  })
})
