import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // ✨ 確保這裡跟你的 GitHub 專案名稱完全一致
  base: mode === 'github-pages' ? '/-E-LEARNING/' : '/',
}))
