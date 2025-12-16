import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig(({ mode }) => {
  // Carrega variáveis de ambiente
  const env = loadEnv(mode, path.resolve(), '');

  return {
    plugins: [react()],
    base: './', 
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      // Injeta APENAS a API Key, sem quebrar o resto do process.env
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // IMPORTANTE: Removemos a linha 'process.env': {} que causava a falha
    },
    server: {
      host: true,
      port: 5173,
      hmr: {
          overlay: false
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      chunkSizeWarningLimit: 1000
    }
  }
})