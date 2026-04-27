import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Hostinger deploys static files. base: './' makes assets path-relative,
// so the build works whether deployed at root or in a subfolder.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
