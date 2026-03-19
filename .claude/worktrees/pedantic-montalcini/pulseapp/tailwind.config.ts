import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // PulseApp marka renkleri
        pulse: {
          50:  '#eef7ff',
          100: '#d9edff',
          200: '#bce0ff',
          300: '#8ecdff',
          400: '#59b0ff',
          500: '#338dff',  // Ana renk
          600: '#1b6df5',
          700: '#1457e1',
          800: '#1746b6',
          900: '#193d8f',
          950: '#142757',
        },
        // Yeşil — başarı, onay
        success: {
          50:  '#ecfdf5',
          500: '#10b981',
          700: '#047857',
        },
        // Kırmızı — hata, uyarı
        danger: {
          50:  '#fef2f2',
          500: '#ef4444',
          700: '#b91c1c',
        },
        // Amber — dikkat
        warning: {
          50:  '#fffbeb',
          500: '#f59e0b',
          700: '#b45309',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
