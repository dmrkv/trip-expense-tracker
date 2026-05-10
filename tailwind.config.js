/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Splitwise-like teal accent
        accent: {
          DEFAULT: '#5bc5a7',
          50: '#effbf6',
          100: '#d6f4e7',
          200: '#aee9d2',
          300: '#7fd9b8',
          400: '#5bc5a7',
          500: '#36a78b',
          600: '#288670',
          700: '#21695a',
          800: '#1c5448',
          900: '#17443c',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
};
