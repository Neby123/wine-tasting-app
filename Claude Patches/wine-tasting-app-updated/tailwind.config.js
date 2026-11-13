/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm Editorial Alabaster -> Stone -> Espresso scale
        slate: {
          50: '#FFFFFF',
          100: '#1E1814',
          200: '#27221E',
          250: '#322D27',
          300: '#3F3932',
          350: '#524B42',
          400: '#635B50',
          500: '#7A7165',
          600: '#A69D8F',
          700: '#D5CCBE',
          800: '#E6DFD3',
          850: '#F4EFE6',
          900: '#FFFDF9',
          950: '#FAF7F2',
        },
        // Calibrated Editorial Burgundy scale for high-contrast light surfaces
        wine: {
          50: '#3D0C17',
          100: '#5A1425',
          200: '#6E172C',
          300: '#821D35',
          400: '#9A2541',
          500: '#B53856',
          600: '#CE627B',
          700: '#E298A9',
          800: '#F0CFD6',
          850: '#F5E6E9',
          900: '#F9EEF0',
          950: '#FCF5F6',
        },
        // Burnished Editorial Gold & Champagne scale for light surfaces
        gold: {
          50: '#4A2E05',
          100: '#634009',
          200: '#784E0C',
          300: '#8A5A10',
          400: '#9A6514',
          500: '#B57B1C',
          600: '#C99335',
          700: '#DFB66A',
          800: '#EDD4A1',
          900: '#F7EBD1',
          950: '#FCF6E8',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
