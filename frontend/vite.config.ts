import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_BACKEND_URL || "http://localhost:9876",
        changeOrigin: true,
      },
      "/ws": {
        target: process.env.VITE_DEV_BACKEND_WS || "ws://localhost:9876",
        ws: true,
      },
    },
  },
})
