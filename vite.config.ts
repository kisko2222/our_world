import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Relative assets work with GitHub Pages regardless of the repository name.
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    // The Firebase SDK is dynamically loaded only when sharing is configured.
    chunkSizeWarningLimit: 520,
  },
})
