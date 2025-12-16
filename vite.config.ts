import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Alterado para '/' para garantir funcionamento correto no Vercel/Vite
  base: '/',
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    host: true,
    hmr: {
      overlay: false
    }
  }
})
