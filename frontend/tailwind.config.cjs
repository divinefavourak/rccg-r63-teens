/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // <--- ENABLE THIS
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        christmas: {
          red: '#8B0000',
          crimson: '#C41E3A',
          gold: '#FFD700',
          'gold-dark': '#B8860B',
          green: '#2F5233',
          dark: '#1a0505',
          light: '#f8fafc', // Snow white for light mode
        }
      },
      // ... keep existing animations/keyframes ...
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gold-text': 'linear-gradient(to bottom, #FDB931 0%, #FFD700 50%, #B8860B 100%)',
        'snow-pattern': "url('https://www.transparenttextures.com/patterns/snow.png')", // Helper
      }
    },
  },
  plugins: [],
}