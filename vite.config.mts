import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
  test: { include: ['shared/**/*.test.ts', 'tests/**/*.test.ts'], testTimeout: 90000, hookTimeout: 90000 },
})
