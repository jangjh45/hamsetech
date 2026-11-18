import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthSession } from '../auth/session'

// children을 주면 단일 화면을 감싸고, 안 주면 레이아웃 라우트로 동작해
// 자식 라우트를 <Outlet />으로 렌더한다. App에서 인증 화면을 뺀 전 구간을
// 한 번에 감쌀 때 후자를 쓴다.
export default function ProtectedRoute({ children }: { children?: ReactNode }) {
  const location = useLocation()
  const session = useAuthSession()
  if (session.status === 'loading') return null
  if (session.status === 'error') {
    return <div role="alert">로그인 상태를 확인할 수 없습니다. 연결을 확인한 뒤 새로고침해 주세요.</div>
  }
  if (session.status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <>{children ?? <Outlet />}</>
}


