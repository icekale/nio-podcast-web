import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'],
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
  },
})
