import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#1e40af', // Azul principal da JRC/Sytel
          'blue-dark': '#1e3a8a',
          'blue-light': '#3b82f6',
        },
      },
    },
  },
  plugins: [],
}

export default config
