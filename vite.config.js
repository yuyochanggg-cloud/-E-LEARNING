import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/良興E-LEARNING/', // ✨ 務必加入這一行，兩邊都要有斜線
})