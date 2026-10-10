import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 로드 순서가 지켜진다: 기반 규칙을 먼저 깔고, 그 위에 디자인 시스템을 얹는다.
import './styles/base.css'
import './styles/dashboard.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { ConfirmProvider } from './components/ConfirmDialog'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </BrowserRouter>
  </StrictMode>,
)
