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
        // Website palette, from the Figma colour variables. Values live in
        // src/styles/site.css. Same caveat as the Console palette above: these
        // are var() references, so opacity modifiers do not work on them.
        ink: 'var(--color-ink)',
        'on-ink': 'var(--color-on-ink)',
        pop: {
          green: 'var(--color-pop-green)',
          lime: 'var(--color-pop-lime)',
          amber: 'var(--color-pop-amber)',
          violet: 'var(--color-pop-violet)',
          pink: 'var(--color-pop-pink)',
          sky: 'var(--color-pop-sky)',
          on: 'var(--color-pop-on)',
        },
        surface: {
          base: 'var(--color-surface-base)',
          raised: 'var(--color-surface-raised)',
          sunken: 'var(--color-surface-sunken)',
        },
        // Figma's color/text/*. Named `content` because `text-text-primary`
        // reads badly and `text-primary` is already the emerald scale.
        content: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          brand: 'var(--color-text-brand)',
        },
        'line-strong': 'var(--color-border-strong)',
        bezel: 'var(--color-bezel)',
      },
      // Figma text styles. Each carries its own line height, tracking and
      // weight, so `text-display-xl` alone reproduces the style.
      //
      // Do not pass these through cn(): tailwind-merge does not know the names,
      // reads `text-title-lg` as a text colour, and drops it when a real colour
      // class follows.
      fontSize: {
        'display-2xl': ['84px', { lineHeight: '88px', letterSpacing: '-0.04em', fontWeight: '800' }],
        'display-xl': ['56px', { lineHeight: '64px', letterSpacing: '-0.03em', fontWeight: '800' }],
        'display-lg': ['40px', { lineHeight: '48px', letterSpacing: '-0.03em', fontWeight: '800' }],
        display: ['32px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '800' }],
        'title-lg': ['24px', { lineHeight: '32px', letterSpacing: '-0.015em', fontWeight: '800' }],
        'title-md': ['20px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '700' }],
        'title-sm': ['17px', { lineHeight: '24px', fontWeight: '700' }],
        'body-lg': ['18px', { lineHeight: '30px', fontWeight: '400' }],
        'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md-strong': ['16px', { lineHeight: '24px', fontWeight: '600' }],
        'body-sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'label-md': ['14px', { lineHeight: '20px', fontWeight: '600' }],
        'label-sm': ['12px', { lineHeight: '16px', fontWeight: '500' }],
      },
      boxShadow: {
        'elevation-1': '0 1px 2px 0 rgba(28, 25, 22, 0.07)',
        'elevation-3': '0 -4px 32px 0 rgba(28, 25, 22, 0.12)',
      },
      borderRadius: {
        'console-sm': 'var(--console-radius-sm)',
        'console-md': 'var(--console-radius-md)',
        'console-lg': 'var(--console-radius-lg)',
        'console-xl': 'var(--console-radius-xl)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // Lora, for Bible text. Deliberately not `serif`: font-serif is already
        // used on the devotional pages and would silently change with it.
        reader: ['Lora', 'Georgia', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        // Was used in LandingPage but never defined here, so it silently did
        // nothing. Only transform/opacity are animated, both compositor-only.
        'fade-in-up': 'fadeInUp 0.6s ease-out both',
        // The track holds two identical groups, so shifting it by half its own
        // width lands on an identical frame and the loop has no seam.
        marquee: 'marquee 40s linear infinite',
        // The idle drift on 3D objects, and the shake they do when their card
        // is hovered. CSS rather than framer-motion: these loop forever, and a
        // CSS transform animation needs no JavaScript per frame.
        float: 'float 5s ease-in-out infinite',
        wiggle: 'wiggle 0.6s ease-in-out',
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
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-9%) rotate(4deg)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg) scale(1)' },
          '25%': { transform: 'rotate(-14deg) scale(1.12)' },
          '75%': { transform: 'rotate(12deg) scale(1.12)' },
        },
      },
    },
  },
  plugins: [],
}