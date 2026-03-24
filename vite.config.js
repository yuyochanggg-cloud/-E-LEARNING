import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // ✨ 確保這裡跟你的 GitHub 專案名稱完全一致
  base: '/-E-LEARNING/', 
})