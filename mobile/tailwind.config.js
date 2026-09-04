/** @type {import('tailwindcss').Config} */

/*
 * Every colour resolves through a CSS variable defined in `global.css`, so a
 * single root class swap re-themes the app and `bg-green/10` still composites
 * correctly. Nothing here hard-codes a hex value.
 */
const themed = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],

  /*
   * Class strategy, not the `media` default.
   *
   * Left unset, NativeWind emits `--css-interop-darkMode: media` and takes dark
   * styling from the OS `prefers-color-scheme` alone — the `.dark:root` block in
   * global.css never matches, so the in-app toggle re-themes nothing that is
   * styled with a class. It still moved anything reading `useTokens()` (plain JS
   * that switches on the scheme), which is why the bottom nav went dark on its
   * own while every screen stayed light.
   */
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        surf: {
          base: themed('surf-base'),
          raised: themed('surf-raised'),
          sunken: themed('surf-sunken'),
          overlay: themed('surf-overlay'),
        },
        ink: {
          1: themed('text-1'),
          2: themed('text-2'),
          3: themed('text-3'),
          inv: themed('text-inv'),
        },
        green: {
          DEFAULT: themed('green'),
          hover: themed('green-hover'),
          pressed: themed('green-pressed'),
          tonal: themed('green-tonal'),
        },
        amber: {
          DEFAULT: themed('amber'),
          bright: themed('amber-bright'),
          tonal: themed('amber-tonal'),
        },
        line: {
          DEFAULT: themed('border'),
          strong: themed('border-strong'),
        },
        nav: {
          bg: themed('nav-bg'),
          border: themed('nav-border'),
        },
        feedback: {
          error: themed('error'),
          caution: themed('caution'),
          info: themed('info'),
          success: themed('success'),
        },
      },

      /*
       * React Native has no synthetic font weight: each weight is a separately
       * loaded font family. These are named `ui-*` / `read-*` rather than
       * `medium` / `bold` so they never collide with Tailwind's own
       * `font-medium` / `font-bold` weight utilities.
       */
      fontFamily: {
        ui: ['Jakarta_400Regular'],
        'ui-md': ['Jakarta_500Medium'],
        'ui-sb': ['Jakarta_600SemiBold'],
        'ui-b': ['Jakarta_700Bold'],
        'ui-xb': ['Jakarta_800ExtraBold'],
        read: ['Lora_400Regular'],
        'read-i': ['Lora_400Regular_Italic'],
        'read-sb': ['Lora_600SemiBold'],
      },

      // 4px base unit (10-design-system.md). Tailwind's default scale is
      // already 4px-derived; these fill the gaps the design actually uses.
      borderRadius: {
        sm: '8px',
        DEFAULT: '10px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        full: '999px',
      },
    },
  },
  plugins: [],
};
