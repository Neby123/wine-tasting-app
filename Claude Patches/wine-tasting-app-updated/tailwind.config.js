/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        wine: {
          50: '#fdf2f4',
          100: '#fbe5e9',
          200: '#f7ced5',
          300: '#f1a8b5',
          400: '#e7778f',
          500: '#d94b6d',
          600: '#c22d53',
          700: '#a31f3f',
          800: '#871c36',
          900: '#711b2f',
          950: '#4a0e17', // Deep velvet burgundy
        },
        gold: {
          50: '#fbf9eb',
          100: '#f6efcc',
          200: '#ecdba0',
          300: '#dfbe6a',
          400: '#d19e3e',
          500: '#b8812e',
          600: '#9b6324',
          700: '#7d4a1f',
          800: '#663c1e',
          900: '#55321c',
          950: '#321c0e',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
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
