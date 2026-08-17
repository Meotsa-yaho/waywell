import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),

    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '웨이웰',
        short_name: '웨이웰',
        description: '오늘 날씨에 맞는 가장 편한 길',
        theme_color: '#1a7f6b',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        // 존재하는 SVG 로고 사용 (PNG 파일 없음). 최신 Chrome은 SVG로도 설치 판정.
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.testgogo\.site\/api\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
