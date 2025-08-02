/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'neon-blue': '#00a3ff',
        'neon-green': '#00ff88',
        'neon-purple': '#a742f5',
        'neon-pink': '#ff00f7',
        'dark-bg': '#0c0c14',
        'panel-bg': '#131324',
      },
      boxShadow: {
        'neon': '0 0 10px rgba(0, 255, 136, 0.5), 0 0 20px rgba(0, 255, 136, 0.3), 0 0 30px rgba(0, 255, 136, 0.1)',
        'neon-blue': '0 0 10px rgba(0, 163, 255, 0.5), 0 0 20px rgba(0, 163, 255, 0.3), 0 0 30px rgba(0, 163, 255, 0.1)',
      },
      backgroundImage: {
        'cyber-grid': `
          linear-gradient(to right, rgba(65, 130, 255, 0.1) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(65, 130, 255, 0.1) 1px, transparent 1px)
        `,
      },
      backgroundSize: {
        'grid': '20px 20px',
      },
      animation: {
        'pulse': 'pulse 2s infinite',
        'flow': 'flow 30s linear infinite',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: 0.6 },
          '50%': { opacity: 1 },
        },
        flow: {
          '0%': { strokeDashoffset: '100' },
          '100%': { strokeDashoffset: '0' },
        },
      },
    },
  },
  plugins: [],
}
