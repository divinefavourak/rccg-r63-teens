import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { qrcode } from 'vite-plugin-qrcode'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // SWC rather than the Babel plugin. @vitejs/plugin-react-swc was already a
    // devDependency and simply unused; it compiles the same output faster.
    react(),
    qrcode(),
    // Writes dist/stats.html. Bundle size was previously unobservable — there
    // was no analyzer of any kind, which is how a 614KB route chunk went
    // unnoticed.
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
    // Every browser this audience uses supports ES2020. The default target
    // ships extra transpilation and helper code for engines nobody here runs.
    target: 'es2020',
    cssCodeSplit: true,
    // Computing gzip size for each chunk measurably slows the build and tells
    // us nothing the visualizer doesn't.
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        /*
          Split the framework out of the app chunk.

          React, ReactDOM and the router change only when a dependency is
          upgraded, while the app code changes on every deploy. Sharing one
          chunk meant a one-line copy edit invalidated 150KB of framework in
          every returning visitor's cache. Separating them means a normal deploy
          re-downloads only what actually changed.
        */
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
            return 'react-vendor'
          }
          if (/[\\/]node_modules[\\/](react-router|react-router-dom)[\\/]/.test(id)) {
            return 'router'
          }
          if (/[\\/]node_modules[\\/]framer-motion[\\/]/.test(id)) {
            return 'motion'
          }
        },
      },
    },
  },
})
