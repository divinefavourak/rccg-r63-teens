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
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981', // Main Emerald
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        accent: {
          DEFAULT: '#F59E0B', // Amber
          hover: '#D97706',
        },
        // Admin Console palette. Values live as CSS custom properties in
        // src/styles/console.css so light/dark swap without a class rebuild.
        // Note: these reference var() directly rather than the
        // `rgb(var(--x) / <alpha-value>)` pattern, so Tailwind opacity
        // modifiers (e.g. bg-console-surface/50) do NOT work on them. Use the
        // pre-mixed *-muted / *-bg tokens where translucency is needed.
        console: {
          canvas: 'var(--console-canvas)',
          surface: 'var(--console-surface)',
          raised: 'var(--console-surface-raised)',
          tinted: 'var(--console-surface-tinted)',
          border: 'var(--console-border)',
          'border-strong': 'var(--console-border-strong)',
          text: 'var(--console-text-primary)',
          body: 'var(--console-text-body)',
          muted: 'var(--console-text-muted)',
          subtle: 'var(--console-text-subtle)',
          disabled: 'var(--console-text-disabled)',
          action: 'var(--console-action)',
          'action-hover': 'var(--console-action-hover)',
          'action-light': 'var(--console-action-light)',
          'action-muted': 'var(--console-action-muted)',
          'data-1': 'var(--console-data-1)',
          'data-2': 'var(--console-data-2)',
          'data-3': 'var(--console-data-3)',
          'data-4': 'var(--console-data-4)',
          info: 'var(--console-info)',
          'info-bg': 'var(--console-info-bg)',
          caution: 'var(--console-caution)',
          'caution-bg': 'var(--console-caution-bg)',
          danger: 'var(--console-danger)',
          'danger-bg': 'var(--console-danger-bg)',
          success: 'var(--console-success)',
          'success-bg': 'var(--console-success-bg)',
          'teacher-bg': 'var(--console-teacher-bg)',
          'teacher-text': 'var(--console-teacher-text)',
          'teacher-label': 'var(--console-teacher-label)',
          'sensitive-bg': 'var(--console-sensitive-bg)',
          'sensitive-text': 'var(--console-sensitive-text)',
          'sensitive-border': 'var(--console-sensitive-border)',
        },
      },
      borderRadius: {
        'console-sm': 'var(--console-radius-sm)',
        'console-md': 'var(--console-radius-md)',
        'console-lg': 'var(--console-radius-lg)',
        'console-xl': 'var(--console-radius-xl)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        // Was used in LandingPage but never defined here, so it silently did
        // nothing. Only transform/opacity are animated, both compositor-only.
        'fade-in-up': 'fadeInUp 0.6s ease-out both',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeInUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}