import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import ProtectedRoute from './ProtectedRoute'
import AdminRoute from './AdminRoute'

// localStorage 상태를 직접 만진다 — auth/token.ts는 얇은 래퍼일 뿐이라 목을 세우면
// 게드가 localStorage를 어떻게 읽는지(다른 통로를 의심) 검증할 수 없어진다.
function setAuth(token: string | null, roles?: string[]) {
  if (token) localStorage.setItem('auth_token', token)
  else localStorage.removeItem('auth_token')
  if (roles) localStorage.setItem('auth_roles', JSON.stringify(roles))
  else localStorage.removeItem('auth_roles')
}

/** 로그인 화면이 받은 복귀 목적지를 그대로 찍어 준다. */
function LoginProbe() {
  const location = useLocation()
  const from = (location.state as { from?: { pathname?: string } } | null)?.from
  return <div>로그인 화면{from?.pathname ? ` (from=${from.pathname})` : ''}</div>
}

function renderAt(path: string, element: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginProbe />} />
        <Route path="/" element={<div>홈</div>} />
        <Route path="/overtime" element={element} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('ProtectedRoute', () => {
  it('토큰이 없으면 로그인 화면으로 보낸다', () => {
    renderAt('/overtime', <ProtectedRoute><div>본문</div></ProtectedRoute>)
    expect(screen.getByText(/로그인 화면/)).toBeTruthy()
    expect(screen.queryByText('본문')).toBeNull()
  })

  it('로그인 화면으로 보낼 때 원래 위치를 복귀 목적지로 넘긴다', () => {
    // 넘기지 않으면 사용자가 보던 화면을 잃는다.
    renderAt('/overtime', <ProtectedRoute><div>본문</div></ProtectedRoute>)
    expect(screen.getByText('로그인 화면 (from=/overtime)')).toBeTruthy()
  })

  it('토큰이 있으면 children을 그대로 그린다', () => {
    setAuth('t')
    renderAt('/overtime', <ProtectedRoute><div>본문</div></ProtectedRoute>)
    expect(screen.getByText('본문')).toBeTruthy()
  })

  it('토큰이 있으면 레이아웃 라우트로 자식 경로를 그린다', () => {
    // children을 주지 않는 형태가 App에서 실제 쓰는 방식이다(<Outlet />).
    setAuth('t')
    render(
      <MemoryRouter initialEntries={['/overtime']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/overtime" element={<div>중첩 본문</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('중첩 본문')).toBeTruthy()
  })

  it('토큰이 비어 있으면 통과시키지 않는다', () => {
    // 빈 문자열은 falsy지만 localStorage에 남아 있다. "값이 있다"가 아니라
    // "토큰이 있다"를 물어야 한다.
    setAuth('')
    renderAt('/overtime', <ProtectedRoute><div>본문</div></ProtectedRoute>)
    expect(screen.getByText(/로그인 화면/)).toBeTruthy()
  })
})

describe('AdminRoute', () => {
  it('토큰이 없으면 로그인 화면으로 보낸다', () => {
    renderAt('/overtime', <AdminRoute><div>관리자 화면</div></AdminRoute>)
    expect(screen.getByText('로그인 화면 (from=/overtime)')).toBeTruthy()
  })

  it('로그인한 일반 회원은 홈으로 돌려보낸다', () => {
    // 관리자 권한이 없는 사용자가 관리자 화면에 도달하면 안 된다.
    setAuth('t', ['USER'])
    renderAt('/overtime', <AdminRoute><div>관리자 화면</div></AdminRoute>)
    expect(screen.getByText('홈')).toBeTruthy()
    expect(screen.queryByText('관리자 화면')).toBeNull()
  })

  it('역할 배열이 비어 있어도 통과시키지 않는다', () => {
    setAuth('t', [])
    renderAt('/overtime', <AdminRoute><div>관리자 화면</div></AdminRoute>)
    expect(screen.getByText('홈')).toBeTruthy()
  })

  it('역할 값이 깨져 있으면 일반 회원으로 취급한다', () => {
    // auth/token.ts는 JSON.parse가 실패하면 빈 배열로 돌린다.
    localStorage.setItem('auth_token', 't')
    localStorage.setItem('auth_roles', '{깨진 JSON')
    renderAt('/overtime', <AdminRoute><div>관리자 화면</div></AdminRoute>)
    expect(screen.getByText('홈')).toBeTruthy()
  })

  it('ADMIN이면 통과한다', () => {
    setAuth('t', ['USER', 'ADMIN'])
    renderAt('/overtime', <AdminRoute><div>관리자 화면</div></AdminRoute>)
    expect(screen.getByText('관리자 화면')).toBeTruthy()
  })

  it('SUPER_ADMIN이면 통과한다', () => {
    setAuth('t', ['SUPER_ADMIN'])
    renderAt('/overtime', <AdminRoute><div>관리자 화면</div></AdminRoute>)
    expect(screen.getByText('관리자 화면')).toBeTruthy()
  })
})