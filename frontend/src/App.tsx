import './App.css'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import RegisterPage from './pages/Register'
import LoginPage from './pages/Login'
import AdminPage from './pages/Admin'
import HomePage from './pages/Home'
import Header from './components/Header'
import AdminRoute from './routes/AdminRoute'
import ProtectedRoute from './routes/ProtectedRoute'
import NoticeDetailPage from './pages/NoticeDetail'
import NoticeEditorPage from './pages/NoticeEditor'
import NoticesPage from './pages/Notices'
import ForgotPasswordPage from './pages/ForgotPassword'
import DeliveryPage from './pages/Delivery'
import ProfilePage from './pages/Profile'
import OvertimeRecordsPage from './pages/OvertimeRecords'
import { setupAutoLogout } from './auth/token'

// 인증 화면은 AuthShell이 화면 전체를 좌우 2단으로 쓰고 왼쪽 브랜드 면에
// 자체 로고와 테마 토글을 갖고 있어서 전역 Header를 렌더하지 않는다.
const AUTH_ROUTES = ['/login', '/register', '/forgot-password']

export default function App() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const hideHeader = AUTH_ROUTES.includes(pathname)

  // 전역 토큰 만료 처리 설정.
  // 만료 시점에 보던 위치를 state.from으로 넘겨 로그인 후 그 화면으로 돌아간다.
  useEffect(() => {
    const cleanup = setupAutoLogout((from) => {
      navigate('/login', { replace: true, state: { from } })
    })
    return cleanup
  }, [navigate])

  return (
    <div>
      {!hideHeader && <Header />}
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        {/* 인증 화면 셋을 뺀 나머지는 전부 로그인이 필요하다 */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/notices" element={<NoticesPage />} />
          <Route path="/notice/:id" element={<NoticeDetailPage />} />
          {/* 공지 작성·수정은 관리자만. 서버도 403으로 막지만 폼까지 갈 이유가 없다 */}
          <Route path="/notice/new" element={<AdminRoute><NoticeEditorPage /></AdminRoute>} />
          <Route path="/notice/:id/edit" element={<AdminRoute><NoticeEditorPage /></AdminRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
          <Route path="/delivery" element={<DeliveryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/overtime" element={<OvertimeRecordsPage />} />
        </Route>
        {/* 없는 경로는 홈으로. 비로그인이면 홈이 다시 로그인으로 보낸다 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

