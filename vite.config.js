// SIMKA PRO | vite.config.js | v1.1 | Fase 1 – Perbaikan pembaruan | 03/10/2026
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath, URL } from 'node:url'

// Mode "demo" menghasilkan satu berkas HTML mandiri (tanpa Supabase) untuk pratinjau tampilan.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const demo = mode === 'demo'
  return {
    base: env.VITE_BASE || './',
    define: { __WAKTU_BUILD__: JSON.stringify(new Date().toISOString()) },
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    plugins: [
      vue(),
      demo && viteSingleFile(),
      VitePWA({
            disable: demo,            // mode demo: tanpa service worker
            registerType: 'autoUpdate',
            injectRegister: false,    // didaftarkan di main.js agar halaman memuat ulang otomatis saat ada versi baru
            includeAssets: ['ikon.svg'],
            manifest: {
              name: 'SIMKA PRO Imam Asy-Syathiby',
              short_name: 'SIMKA PRO',
              description: 'Sistem Manajemen Kepegawaian Terintegrasi Pondok Pesantren Imam Asy-Syathiby',
              lang: 'id',
              theme_color: '#C7332F',
              background_color: '#FAF6F3',
              display: 'standalone',
              orientation: 'portrait',
              start_url: './',
              scope: './',
              icons: [
                { src: 'ikon/ikon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'ikon/ikon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'ikon/ikon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: {
              navigateFallback: 'index.html', globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2}'],
              cleanupOutdatedCaches: true, clientsClaim: true, skipWaiting: true,
            },
          }),
    ],
    build: demo
      ? { outDir: 'dist-demo', assetsInlineLimit: 100000000, cssCodeSplit: false, chunkSizeWarningLimit: 4000 }
      : { outDir: 'dist', chunkSizeWarningLimit: 1200 },
  }
})
