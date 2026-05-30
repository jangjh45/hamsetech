import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
const apiHost = process.env.VITE_API_HOST ?? 'localhost'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: `http://${apiHost}:8080`,
        changeOrigin: true,
      },
    },
  },
})
