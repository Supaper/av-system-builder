import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 버전 단일 소스: package.json → __APP_VERSION__ 주입 (헤더 배지·릴리즈노트에서 사용)
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/av-system-builder/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
})
