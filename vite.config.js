import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        runtimeCaching: [{
          urlPattern: ({ request }) => request.destination === 'image',
          handler: 'CacheFirst',
          options: {
            cacheName: 'nio-artwork-v1',
            cacheableResponse: { statuses: [0, 200] },
            expiration: { maxEntries: 150, maxAgeSeconds: 30 * 24 * 60 * 60 },
          },
        }],
      },
      manifest: {
        id: '/nio-podcast-web/',
        name: 'Nio Podcast',
        short_name: 'NIO Radio',
        start_url: '/nio-podcast-web/',
        scope: '/nio-podcast-web/',
        display: 'standalone',
        background_color: '#0A0E14',
        theme_color: '#00A0E9',
        description: 'NIO Radio 播客客户端',
        lang: 'zh-CN',
        icons: [
          { src: 'favicon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-180.png', sizes: '180x180', type: 'image/png' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  base: '/nio-podcast-web/',
  test: {
    environment: 'jsdom',
    setupFiles: './src/testSetup.js',
    include: ['src/**/*.{test,spec}.{js,jsx}', 'scripts/**/*.{test,spec}.{js,jsx}'],
    exclude: ['**/node_modules/**', '**/.worktrees/**'],
  },
})
