import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // REST API calls
      '/api': {
        target:    'http://localhost:4000',
        changeOrigin: true,
      },
      // Socket.IO — MUST point to the server (4000), not the client (was wrong: 5173)
      '/socket.io': {
        target: 'http://localhost:4000',
        ws:     true,          // enable WebSocket proxying
        changeOrigin: true,
      },
    },
  },
})