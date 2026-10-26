import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // El portal y la API comparten origen en desarrollo: las cookies de sesión
    // (httpOnly, SameSite) funcionan sin configurar CORS (RI-08).
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
