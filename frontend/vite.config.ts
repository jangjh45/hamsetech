/// <reference types="vitest/config" />
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

  test: {
    // 테스트는 DOM을 건드린다(api/client.ts의 localStorage, auth/token.ts의
    // 커스텀 이벤트). 개발 서버용 설정이 아니라 테스트 전용 환경이므로
    // environment를 jsdom으로 못 박는다 — vite.config.ts를 테스트가 돌 때마다
    // 다시 로드하기 때문이다.
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // 테스트는 느리지 않은데 출력이 밀리면 CI 로그가 한 줄로 뭉개진다.
    reporters: 'default',
  },
})
