import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/getToken': 'http://localhost:3001',
      '/upload-pdf': 'http://localhost:3001',
      '/check-interactions': 'http://localhost:3001',
      '/api': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
    },
  },
})
