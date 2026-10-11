import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

const root = path.dirname(fileURLToPath(import.meta.url))

/** Tonal 6 and @tonaljs point `main` at `dist/index.js`, which several packages do not publish. */
function resolveTonal(): Plugin {
  return {
    name: 'resolve-tonal',
    enforce: 'pre',
    resolveId(source) {
      if (source.startsWith('.') || source.startsWith('\0') || path.isAbsolute(source)) return null
      const packageName = source.startsWith('@')
        ? source.split('/').slice(0, 2).join('/')
        : source.split('/')[0]
      if (!packageName || packageName !== source) return null
      if (packageName !== 'tonal' && !packageName.startsWith('@tonaljs/')) return null
      const moduleFile = path.join(root, 'node_modules', packageName, 'dist', 'index.mjs')
      return fs.existsSync(moduleFile) ? moduleFile : null
    },
  }
}

export default defineConfig({
  plugins: [
    resolveTonal(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'STRING LAB',
        short_name: 'STRING LAB',
        description: '五度圏からコード進行を作り、ベースとギターの指板で学ぶ',
        lang: 'ja',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#07111a',
        theme_color: '#07111a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'string-lab-fonts',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    server: {
      deps: {
        inline: ['tonal', /@tonaljs\//],
      },
    },
  },
})
