/**
 * Brand mark URLs, served from public/img/ by the image pipeline
 * (scripts/optimize-images.mjs). Regenerate with `npm run images`.
 *
 * These were previously `import logo from '../assets/logo.jpg'` against 3000x3000
 * camera-resolution files — faith_logo.jpg alone was 467KB and rendered in both
 * the Navbar and the Footer, so every route on the site paid for it twice.
 *
 * Plain WebP rather than a <picture> element: these render at 32-64 CSS px, the
 * 192px WebP is 3-8KB, and AVIF would save ~2KB for materially more markup.
 * WebP has been supported everywhere relevant since Android WebView 4.4.
 * The PNG variants exist for html2canvas, which rasterises the ticket for PDF
 * export and is happier with a format it can decode synchronously.
 */
export const BRAND = {
  /** RCCG mark. */
  rccg: '/img/rccgLogo-192.webp',
  rccgPng: '/img/rccgLogo-fallback.png',
  /** Faith Tribe wordmark. */
  faith: '/img/faithLogo-192.webp',
  faithPng: '/img/faithLogo-fallback.png',
  /** Faith Tribe circular logo, also the favicon source. */
  faithTribe: '/img/faithTribeLogo-192.webp',
  faithTribePng: '/img/faithTribeLogo-fallback.png',
} as const;
