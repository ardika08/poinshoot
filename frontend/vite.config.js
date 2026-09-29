import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dev server hanya dipakai lokal — tanpa proxy (frontend pakai VITE_API_URL absolut)
  server: {
    port: 8081,
    host: true,
  },
  // Build statis untuk Coolify (diserve sebagai static site)
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
