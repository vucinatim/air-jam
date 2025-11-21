import type { Config } from 'tailwindcss'
import path from 'node:path'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    path.resolve(__dirname, '../../packages/sdk/src/**/*.{ts,tsx}'),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config
