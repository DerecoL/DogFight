import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    exclude: [...configDefaults.exclude, '.worktrees/**'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
