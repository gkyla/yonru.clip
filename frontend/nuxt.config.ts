import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxt/icon',
    '@nuxt/eslint'
  ],
  css: [
    '~/assets/css/fonts.css',
    '~/assets/css/main.css'
  ],
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'Yonru',
      link: []
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
    optimizeDeps: {
      include: [
        '@tiptap/vue-3',
        '@tiptap/starter-kit',
      ]
    }
  }
})
