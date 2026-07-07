import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { qrcode } from 'vite-plugin-qrcode'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), qrcode()],
  server: {
    host: true,
    port: 5173,
     // Crucial for local dev SPA routing
  },
  build: {
    outDir: 'dist',
  }
})