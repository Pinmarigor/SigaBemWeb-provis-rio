import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/sigabem/api': {
        target: 'https://labgeo3.recife.ifpe.edu.br',
        changeOrigin: true,
        secure: false,
      },

      '/api/buses': {
        target: 'http://192.168.0.77:8090',
        changeOrigin: true,
      },

      '/apictm': {
        target: 'https://labgeo3.recife.ifpe.edu.br',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
