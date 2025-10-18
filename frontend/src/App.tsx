import './App.css'
import { Route, Routes } from 'react-router-dom'
import { useEffect } from 'react'
import RegisterPage from './pages/Register'
import LoginPage from './pages/Login'
import AdminPage from './pages/Admin'
import HomePage from './pages/Home'
import Header from './components/Header'
import AdminRoute from './routes/AdminRoute'
import NoticeDetailPage from './pages/NoticeDetail'
import NoticeEditorPage from './pages/NoticeEditor'
import NoticesPage from './pages/Notices'
import ForgotPasswordPage from './pages/ForgotPassword'
import DeliveryPage from './pages/Delivery'
import { setupAutoLogout } from './auth/token'

export default function App() {
  // 전역 토큰 만료 처리 설정
  useEffect(() => {
    const cleanup = setupAutoLogout()
    return cleanup
  }, [])

  return (
    <div style={{ padding: 24 }}>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/notices" element={<NoticesPage />} />
        <Route path="/notice/:id" element={<NoticeDetailPage />} />
        <Route path="/notice/new" element={<NoticeEditorPage />} />
        <Route path="/notice/:id/edit" element={<NoticeEditorPage />} />
        <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
        <Route path="/delivery" element={<DeliveryPage />} />
      </Routes>
    </div>
  )
}

