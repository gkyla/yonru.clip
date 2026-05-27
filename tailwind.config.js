module.exports = {
  content: [
    "./frontend/app/components/**/*.{js,vue,ts}",
    "./frontend/app/layouts/**/*.vue",
    "./frontend/app/pages/**/*.vue",
    "./frontend/app/plugins/**/*.{js,ts}",
    "./frontend/app.vue",
    "./frontend/app/app.vue",
    "./frontend/app/error.vue"
  ],
  theme: {
    extend: {
      borderRadius: {
        'none': '0',
        'sm': '0',
        'DEFAULT': '0',
        'md': '0',
        'lg': '0',
        'xl': '0',
        '2xl': '0',
        '3xl': '0',
        'full': '9999px',
      },
      colors: {
        accent: {
          500: '#CFFF50', // Radioactive/Acid green
          600: '#B2E630',
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
        mono: ['"Fira Code"', 'monospace'],
      }
    },
  },
  plugins: [],
}
