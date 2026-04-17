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
          950: '#f8fafc',
          900: '#ffffff',
          800: '#f1f5f9',
          700: '#e2e8f0',
          600: '#cbd5e1',
          500: '#94a3b8',
          400: '#64748b',
          300: '#475569',
          200: '#334155',
          100: '#1e293b',
          50:  '#0f172a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
