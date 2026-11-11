import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The atomm generator build: its own entry page (the interface built on
// atomm's layout template), relative asset paths so it runs from any
// path inside the platform, written to dist-atomm.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-atomm',
    rollupOptions: { input: 'atomm.html' },
  },
})
