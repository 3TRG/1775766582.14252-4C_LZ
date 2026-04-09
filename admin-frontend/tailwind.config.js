/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'quantum-blue': '#00d4ff',
        'quantum-purple': '#9d4edd',
        'quantum-pink': '#ff006e',
        'quantum-green': '#06ffa5',
        'quantum-yellow': '#ffb703',
        'quantum-red': '#e63946',
        'quantum-dark': '#0a0e27',
        'quantum-darker': '#050817',
        'quantum-card': 'rgba(16, 20, 40, 0.8)',
        'quantum-border': 'rgba(0, 212, 255, 0.2)',
      },
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}