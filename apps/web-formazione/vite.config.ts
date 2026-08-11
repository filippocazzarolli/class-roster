import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    /*
     * Porta fissa e `strictPort`: `pnpm dev` lancia le due app in parallelo, e senza
     * questo la seconda scivolerebbe su una porta libera qualsiasi. L'api sta su 3001.
     */
    port: 5174,
    strictPort: true,
    proxy: {
      /*
       * Il codice chiama `/api/...` con URL relative — come in produzione, dove le due
       * cose stanno dietro lo stesso host. Il prefisso `api` è quello impostato da
       * `setGlobalPrefix` in `apps/api/src/main.ts`, quindi non serve riscrivere il path.
       */
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
