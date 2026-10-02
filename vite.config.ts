import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import { readPublicConfig } from './src/lib/config.ts'

export default defineConfig(({ mode, command }) => {
  if (command === 'build') readPublicConfig(loadEnv(mode, process.cwd(), 'VITE_'))
  return { plugins: [react()], test: { environment: 'jsdom', exclude: ['node_modules/**', 'e2e/**'] } }
})
