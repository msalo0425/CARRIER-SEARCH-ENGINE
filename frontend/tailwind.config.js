/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          50:  '#fdfbeb',
          100: '#faf4c7',
          200: '#f5e98f',
          300: '#edd84a',
          400: '#e5c520',
          500: '#D4AF37',
          600: '#b8920f',
          700: '#91700c',
          800: '#765610',
          900: '#634613',
          950: '#3a2505',
        },
        ink: {
          950: '#060606',
          900: '#0d0d0d',
          800: '#141414',
          700: '#1c1c1c',
          600: '#242424',
          500: '#2e2e2e',
          400: '#3a3a3a',
          300: '#4a4a4a',
          200: '#6b6b6b',
          100: '#8a8a8a',
          50:  '#a8a8a8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
