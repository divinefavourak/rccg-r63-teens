/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
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
          light: '#f8fafc',
        }
      },
      animation: {
        'blob': 'blob 7s infinite',
        'float': 'float 3s ease-in-out infinite',
        'snow': 'snow 10s linear infinite',
        'shine': 'shine 3s infinite',
        'swing': 'swing 3s ease-in-out infinite',
        'twinkle': 'twinkle 2s ease-in-out infinite',
        'wave': 'wave 3s ease-in-out infinite', // <--- NEW
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
        snow: {
          '0%': { transform: 'translateY(-10px) translateX(0)', opacity: '0' },
          '10%': { opacity: '1' },
          '100%': { transform: 'translateY(100vh) translateX(20px)', opacity: '0' }
        },
        shine: {
          '0%, 100%': { backgroundPosition: '200% center' },
        },
        swing: {
          '0%, 100%': { transform: 'rotate(-5deg)' },
          '50%': { transform: 'rotate(5deg)' },
        },
        twinkle: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(0.8)' },
          '50%': { opacity: '1', transform: 'scale(1.2)' },
        },
        // NEW WAVE KEYFRAME
        wave: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-5deg)' },
          '75%': { transform: 'rotate(5deg)' },
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