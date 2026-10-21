import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'apple-touch-icon-precomposed.png'],
      manifest: {
        id: '/',
        scope: '/',
        name: 'Encore — дневник концертов',
        short_name: 'Encore',
        description: 'Воспоминания о концертах, планы и все билеты в одном месте',
        lang: 'ru',
        theme_color: '#0E0E12',
        background_color: '#0E0E12',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        // "-v3" in the names: Safari caches home-screen icons by URL, a new name forces a fresh fetch
        icons: [
          { src: '/icons/apple-touch-icon-v3.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192-v3.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512-v3.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512-v3.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
      },
    }),
  ],
})
