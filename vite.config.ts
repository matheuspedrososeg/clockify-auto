import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // GitHub OAuth endpoints don't send CORS headers — proxy them through Vite's dev server
      '/github-device': {
        target: 'https://github.com/login/device',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/github-device/, ''),
      },
      '/github-oauth': {
        target: 'https://github.com/login/oauth',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/github-oauth/, ''),
      },
    },
  },
})
