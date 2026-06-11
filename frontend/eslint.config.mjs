// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    ignores: ['tests/**/*']
  },
  {
    files: ['app/**/*.{ts,vue}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  }
)
