import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Con `npm run dev` las llamadas a /api se reenvian al gateway local (puerto 18100 por defecto).
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: { outDir: 'dist', sourcemap: false, target: 'es2022', chunkSizeWarningLimit: 700 },
  server: { port: 5173, proxy: { '/api': process.env.PORTAL_API_PROXY ?? 'http://127.0.0.1:18100' } },
})
