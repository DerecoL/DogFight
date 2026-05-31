import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'taptap' ? './' : '/',
  plugins: [react()],
  test: {
    exclude: [...configDefaults.exclude, '.worktrees/**'],
    maxConcurrency: 1,
    sequence: {
      concurrent: false,
      hooks: 'list',
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
}))
