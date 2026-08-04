import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getToken } from '../auth/token'

// children을 주면 단일 화면을 감싸고, 안 주면 레이아웃 라우트로 동작해
// 자식 라우트를 <Outlet />으로 렌더한다. App에서 인증 화면을 뺀 전 구간을
// 한 번에 감쌀 때 후자를 쓴다.
export default function ProtectedRoute({ children }: { children?: ReactNode }) {
  const location = useLocation()
  if (!getToken()) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <>{children ?? <Outlet />}</>
}


