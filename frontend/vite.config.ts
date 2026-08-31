import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
const apiHost = process.env.VITE_API_HOST ?? 'localhost'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
      interval: 100,
    },
    proxy: {
      '/api': {
        target: `http://${apiHost}:8080`,
        // Nginx(프로덕션)처럼 원본 Host를 그대로 넘긴다. Host를 backend:8080으로
        // 바꾸면 Origin과 어긋나 스프링이 교차 오리진으로 보고 403을 낸다.
        changeOrigin: false,
      },
    },
  },
})
