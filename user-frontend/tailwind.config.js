/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Quantum theme colors
        quantum: {
          primary: '#6366f1',
          secondary: '#8b5cf6',
          accent: '#06b6d4',
          dark: '#0f172a',
          darker: '#020617',
          light: '#f1f5f9',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #6366f1, 0 0 10px #6366f1' },
          '100%': { boxShadow: '0 0 10px #8b5cf6, 0 0 20px #8b5cf6' },
        }
      }
    },
  },
  plugins: [],
}
