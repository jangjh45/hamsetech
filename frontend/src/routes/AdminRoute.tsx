import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { isAdmin, useAuthSession } from '../auth/session'

export default function AdminRoute({ children }: { children: ReactNode }) {
  const location = useLocation()
  const session = useAuthSession()
  if (session.status === 'loading') return null
  if (session.status === 'error') {
    return <div role="alert">로그인 상태를 확인할 수 없습니다. 연결을 확인한 뒤 새로고침해 주세요.</div>
  }
  if (session.status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if (!isAdmin()) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}


