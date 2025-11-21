import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@air-jam/sdk': path.resolve(__dirname, '../../packages/sdk/src'),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
})
