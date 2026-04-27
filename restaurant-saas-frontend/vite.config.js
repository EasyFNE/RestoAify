import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Hostinger deploys static files. base: './' makes assets path-relative,
// so the build works whether deployed at root or in a subfolder.
// server.historyApiFallback: always serve index.html for deep routes
// so React Router handles /app/restaurants, /platform/tenants etc.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    open: true,
    historyApiFallback: true,
  },
  preview: {
    port: 4173,
    historyApiFallback: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
