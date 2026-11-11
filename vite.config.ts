import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Two pages ship to GitHub Pages:
//   index.html — the original three-step designer
//   atomm.html — the interface built on atomm's layout template, which
//                works for everyone (ordinary download buttons when it is
//                not hosted by atomm)
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: { input: { main: 'index.html', atomm: 'atomm.html' } },
  },
})
