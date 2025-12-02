import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    historyApiFallback: true, // Crucial for local dev SPA routing
  },
  build: {
    outDir: 'dist',
  }
})