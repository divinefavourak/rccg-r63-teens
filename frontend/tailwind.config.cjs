/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Enables dark mode
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        christmas: {
          red: '#8B0000',      // Deep red background
          crimson: '#C41E3A',  // Brighter red for highlights
          gold: '#FFD700',     // Standard gold
          'gold-dark': '#B8860B', // Shadow gold
          green: '#2F5233',    // Pine green
          dark: '#1a0505',     // Very dark red/black for depth
          light: '#f8fafc',    // Snow white for light mode
        }
      },
      animation: {
        'blob': 'blob 7s infinite',
        'float': 'float 3s ease-in-out infinite',
        'snow': 'snow 10s linear infinite', // <--- THIS WAS MISSING
        'shine': 'shine 3s infinite',
      },
      keyframes: {
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        snow: { // <--- THIS WAS MISSING
          '0%': { transform: 'translateY(-10px) translateX(0)', opacity: '0' },
          '10%': { opacity: '1' },
          '100%': { transform: 'translateY(100vh) translateX(20px)', opacity: '0' }
        },
        shine: {
          '0%, 100%': { backgroundPosition: '200% center' },
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gold-text': 'linear-gradient(to bottom, #FDB931 0%, #FFD700 50%, #B8860B 100%)',
        'snow-pattern': "url('https://www.transparenttextures.com/patterns/snow.png')",
      }
    },
  },
  plugins: [],
}