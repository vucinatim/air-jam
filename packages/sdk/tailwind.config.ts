import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#0f172a',
      },
    },
  },
  plugins: [],
}

export default config
