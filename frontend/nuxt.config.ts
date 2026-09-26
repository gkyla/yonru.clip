import { fileURLToPath } from 'node:url'
import { defineNuxtConfig } from 'nuxt/config'

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
      ],
      exclude: [
        '../shared/remotion/**/*'
      ]
    }
  },
  telemetry: false,
  ssr: false,
  vite: {
    plugins: [
      {
        name: 'remotion-react-jsx',
        enforce: 'pre',
        async transform(code: string, id: string) {
          const cleanId = id.split('?')[0] || ''
          if (cleanId.endsWith('.tsx') && (cleanId.includes('shared/remotion') || cleanId.includes('RemotionPlayerView'))) {
            const { transform } = await import('esbuild')
            const result = await transform(code, {
              loader: 'tsx',
              jsx: 'automatic',
              jsxImportSource: 'react',
              sourcefile: cleanId,
              sourcemap: true
            })
            return {
              code: result.code,
              map: result.map
            }
          }
        }
      }
    ],
    vueJsx: {
      exclude: [
        /shared\/remotion/,
        /RemotionPlayerView/
      ]
    },
    resolve: {
      alias: {
        '@yonru/remotion': fileURLToPath(new URL('../shared/remotion/src', import.meta.url)),
        'react': fileURLToPath(new URL('./node_modules/react', import.meta.url)),
        'react-dom': fileURLToPath(new URL('./node_modules/react-dom', import.meta.url)),
        'remotion': fileURLToPath(new URL('./node_modules/remotion', import.meta.url)),
        '@remotion/player': fileURLToPath(new URL('./node_modules/@remotion/player', import.meta.url))
      },
      dedupe: ['vue', 'react', 'react-dom', 'remotion', '@remotion/player']
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
