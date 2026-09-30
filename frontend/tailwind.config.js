export default {
  content: [
    './app/components/**/*.{js,vue,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/plugins/**/*.{js,ts}',
    './app.vue',
    './app/app.vue',
    './app/error.vue'
  ],
  theme: {
    extend: {
      borderRadius: {
        none: '0',
        sm: '0',
        DEFAULT: '0',
        md: '0',
        lg: '0',
        xl: '0',
        '2xl': '0',
        '3xl': '0',
        full: '9999px'
      },
      colors: {
        accent: {
          400: '#FFE033',
          500: '#ffd700', // Gold
          600: '#E6C200'
        },
        surface: {
          dark: '#09090B',
          card: '#121214',
          panel: '#1A1A1D',
          border: '#27272A'
        }
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        mono: ['"Fira Code"', 'monospace']
      }
    }
  },
  plugins: []
};
