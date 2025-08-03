import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174, // PulseIntel Frontend - avoid conflict with Precision9 (5173)
    host: '0.0.0.0',
    allowedHosts: ['app.precision9bot.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        secure: false
      }
    }
  }
}) 