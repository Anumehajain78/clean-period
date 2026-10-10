import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In `npm run dev`, requests to /api are forwarded to VITE_API_URL so the
// browser does not hit the API's CORS rule (it only allows the deployed site).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = (env.VITE_API_URL || '').replace(/\/$/, '')
  return {
    plugins: [react(), tailwindcss()],
    server: target
      ? {
          proxy: {
            '/api': { target, changeOrigin: true, secure: true, rewrite: (path) => path.replace(/^\/api/, '') },
          },
        }
      : {},
  }
})
