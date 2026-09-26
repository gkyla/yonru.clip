import { fileURLToPath } from 'node:url'
import { defineNuxtConfig } from 'nuxt/config'
import react from '@vitejs/plugin-react'

export default defineNuxtConfig({
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxt/icon',
    '@nuxt/eslint'
  ],
  eslint: {
    config: {
      standalone: true,
      typescript: true
    }
  },
  css: [
    '~/assets/css/fonts.css',
    '~/assets/css/main.css'
  ],
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'Yonru',
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'alternate icon', type: 'image/x-icon', href: '/favicon.ico' }
      ]
    }
  },
  compatibilityDate: '2024-04-03',
  typescript: {
    typeCheck: false,
    strict: true,
    tsConfig: {
      include: [
        '../tests/**/*'
      ]
    }
  },
  telemetry: false,
  ssr: false,
  vite: {
    plugins: [
      react({
        include: [
          /shared\/remotion\/.*\.tsx?$/,
          /\.tsx$/
        ]
      })
    ],
    resolve: {
      alias: {
        '@yonru/remotion': fileURLToPath(new URL('../shared/remotion/src', import.meta.url))
      }
    },
    server: {
      fs: {
        allow: ['..']
      }
    },
    optimizeDeps: {
      include: [
        '@tiptap/vue-3',
        '@tiptap/starter-kit',
        '@remotion/player',
        'react',
        'react-dom',
        'react-dom/client'
      ]
    }
  }
})
