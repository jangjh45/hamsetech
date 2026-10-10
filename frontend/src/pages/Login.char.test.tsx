import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import LoginPage from './Login'

vi.mock('../api/client', () => ({ apiFetch: vi.fn() }))
vi.mock('../auth/token', () => ({
  saveAuth: vi.fn(),
  saveDisplayName: vi.fn(),
}))

afterEach(cleanup)

describe('LoginPage — 안내 메시지', () => {
  it('프로필에서 전달한 비밀번호 변경 안내를 표시한다', () => {
    render(
      <MemoryRouter initialEntries={[{
        pathname: '/login',
        state: { notice: '비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해 주세요.' },
      }]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('status').textContent).toContain('새 비밀번호로 다시 로그인해 주세요.')
  })
})
