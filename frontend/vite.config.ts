import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In dev, /api goes to the local API (python scripts/local_api.py).
// In production, set VITE_API_URL to the API Gateway URL.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
