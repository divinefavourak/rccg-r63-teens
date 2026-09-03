/**
 * Image pipeline. Reads camera originals from assets-source/ and writes
 * responsive AVIF/WebP/JPEG derivatives into public/img/, plus a typed manifest
 * at src/generated/images.ts that <ResponsiveImage> consumes.
 *
 * Run with `npm run images`. The originals are gitignored and never enter the
 * Vite build graph — importing a 5184x3456 JPEG from src/ made Vite emit the
 * whole 8MB file into dist/ verbatim, which is what this replaces.
 *
 * Two things here are load-bearing and easy to lose:
 *
 * 1. `.rotate()` with no argument. img2 and mummyJ carry EXIF orientation 8
 *    (rotate 270). Browsers honour that tag; sharp does not unless asked, so
 *    dropping this call ships those two photos sideways.
 * 2. The LQIP is encoded *after* the same rotate, so its aspect ratio matches
 *    the real derivative rather than the pre-rotation metadata.
 */
import sharp from 'sharp';
import { mkdir, writeFile, readdir, rm } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = 'assets-source';
const OUT = 'public/img';
const MANIFEST = 'src/generated/images.ts';

/**
 * Per-image config. `widths` are the intrinsic pixel widths emitted; the
 * browser picks one via srcset + sizes.
 *
 * Photos get 480/960/1600: 480 covers a phone at 1x, 960 covers a phone at 2x
 * and a tablet at 1x, 1600 covers desktop. Going past 1600 would re-create the
 * problem this script exists to solve — the carousel renders into a 300x400 box.
 *
 * Logos are square marks rendered at 40-64 CSS px, so 96/192 covers 1x through 3x.
 */
const JOBS = [
  { name: 'img1', file: 'img1.JPG', kind: 'photo' },
  { name: 'img2', file: 'img2.JPG', kind: 'photo' },
  { name: 'img3', file: 'img3.JPG', kind: 'photo' },
  { name: 'img4', file: 'img4.JPG', kind: 'photo' },
  { name: 'img5', file: 'img5.JPG', kind: 'photo' },
  { name: 'mummyJ', file: 'mummyJ.JPG', kind: 'photo' },
  { name: 'faithLogo', file: 'faith_logo.jpg', kind: 'logo' },
  { name: 'faithTribeLogo', file: 'faith_tribe_logo.jpg', kind: 'logo' },
  { name: 'rccgLogo', file: 'logo.jpg', kind: 'logo' },
];

const PRESETS = {
  photo: {
    // 1280 sits between 960 and 1600 so a 2x phone is not forced all the way up
    // to the largest file for a slot that only needs ~1200 device pixels.
    widths: [480, 960, 1280, 1600, 2048],
    fallbackWidth: 1280,
    // quality 65, not 50. At 960px wide that is 60KB against 36KB — the extra
    // 24KB buys back detail that q50 smears, which was visible in the carousel.
    // chromaSubsampling 4:4:4 keeps full colour resolution; AVIF's 4:2:0 default
    // is what makes saturated edges (skin tones, the green branding) look muddy.
    avif: { quality: 65, effort: 6, chromaSubsampling: '4:4:4' },
    webp: { quality: 82, effort: 6, smartSubsample: true },
    jpeg: { quality: 82, mozjpeg: true, progressive: true, chromaSubsampling: '4:4:4' },
  },
  logo: {
    widths: [96, 192, 288],
    fallbackWidth: 288,
    // Logos carry hard edges and text, where compression artefacts read as
    // sloppiness rather than softness — and at these sizes the files are a few
    // KB either way, so quality is nearly free.
    avif: { quality: 82, effort: 6, chromaSubsampling: '4:4:4' },
    webp: { quality: 92, effort: 6 },
    // Logos sit on varying backgrounds, so the fallback keeps alpha as PNG.
    // `palette: true` used to be set here: it quantises to 256 colours, which
    // bands any gradient in the mark. Not worth the few KB it saved.
    png: { compressionLevel: 9 },
  },
};

/**
 * A 20px-wide WebP, inlined as a data URI. Rendered as a blurred background
 * behind the real image so there is something on screen during the fetch
 * instead of an empty box.
 */
async function lqip(pipeline) {
  const buf = await pipeline
    .clone()
    .resize({ width: 20 })
    .webp({ quality: 20, alphaQuality: 20 })
    .toBuffer();
  return `data:image/webp;base64,${buf.toString('base64')}`;
}

async function run() {
  if (!existsSync(SRC)) {
    console.error(`Missing ${SRC}/ — the originals live there and are gitignored.`);
    process.exit(1);
  }

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  await mkdir(path.dirname(MANIFEST), { recursive: true });

  const manifest = {};
  let totalIn = 0;
  let totalOut = 0;

  for (const job of JOBS) {
    const preset = PRESETS[job.kind];
    const inPath = path.join(SRC, job.file);
    if (!existsSync(inPath)) {
      console.warn(`skip ${job.file} (not found)`);
      continue;
    }

    // .rotate() bakes EXIF orientation into the pixels. Everything downstream
    // derives from `base`, so width/height below are post-rotation and correct.
    const base = sharp(inPath).rotate();
    const meta = await base.metadata();
    const rotated = await base.clone().toBuffer({ resolveWithObject: true });
    const srcW = rotated.info.width;
    const srcH = rotated.info.height;

    const entry = {
      width: srcW,
      height: srcH,
      lqip: await lqip(base),
      avif: {},
      webp: {},
      fallback: '',
    };

    for (const w of preset.widths) {
      if (w > Math.max(srcW, srcH)) continue; // never upscale
      // Square bounding box, not a bare width. Resizing a portrait 3456x5184 by
      // width alone yields 1600x2400 — 3.8MP against 1.7MP for the same nominal
      // width in landscape, which is why the two portrait shots were ~60% heavier
      // than their landscape siblings. `fit: inside` caps the long edge instead.
      const resized = base
        .clone()
        .resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true });

      const avifName = `${job.name}-${w}.avif`;
      const webpName = `${job.name}-${w}.webp`;
      const a = await resized.clone().avif(preset.avif).toFile(path.join(OUT, avifName));
      const b = await resized.clone().webp(preset.webp).toFile(path.join(OUT, webpName));
      // Key on what sharp *emitted*, not what we asked for. A srcset `w`
      // descriptor that disagrees with the file's real intrinsic width makes the
      // browser choose the wrong candidate.
      entry.avif[a.width] = `/img/${avifName}`;
      entry.webp[b.width] = `/img/${webpName}`;
      totalOut += a.size + b.size;
    }

    // Fallback for browsers without AVIF/WebP (old Android WebView still exists
    // in this audience, which is exactly why the fallback is not skipped).
    const fw = preset.fallbackWidth;
    const resized = base
      .clone()
      .resize({ width: fw, height: fw, fit: 'inside', withoutEnlargement: true });
    const n = `${job.name}-fallback.${job.kind === 'logo' ? 'png' : 'jpg'}`;
    const r = await (job.kind === 'logo'
      ? resized.clone().png(preset.png)
      : resized.clone().jpeg(preset.jpeg)
    ).toFile(path.join(OUT, n));
    entry.fallback = `/img/${n}`;
    totalOut += r.size;

    totalIn += statSync(inPath).size;
    manifest[job.name] = entry;
    console.log(
      `${job.name.padEnd(16)} ${srcW}x${srcH} (orient ${meta.orientation ?? 1}) -> ${preset.widths.filter((w) => w <= srcW).join('/')}`
    );
  }

  // Social share card. Facebook/WhatsApp/Twitter crawlers do not decode AVIF and
  // are unreliable on WebP, so og:image has to be a plain JPEG. 1200x630 is the
  // ratio every scraper crops to.
  const ogSrc = path.join(SRC, 'img1.JPG');
  if (existsSync(ogSrc)) {
    const r = await sharp(ogSrc)
      .rotate()
      .resize(1200, 630, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 80, mozjpeg: true, progressive: true })
      .toFile(path.join('public', 'og-image.jpg'));
    console.log(`og-image.jpg    -> 1200x630, ${(r.size / 1024).toFixed(0)} KB`);
  }

  // Favicons. The old one was a 574KB .jpg declared as type="image/png" on a
  // /src/assets/ path — wrong format, wrong size, wrong location.
  const favSrc = path.join(SRC, 'faith_tribe_logo.jpg');
  if (existsSync(favSrc)) {
    for (const [name, size] of [
      ['favicon-32.png', 32],
      ['favicon-192.png', 192],
      ['apple-touch-icon.png', 180],
    ]) {
      await sharp(favSrc)
        .rotate()
        .resize(size, size, { fit: 'cover' })
        .png({ compressionLevel: 9 })
        .toFile(path.join('public', name));
    }
    console.log('favicons        -> 32 / 180 / 192 png');
  }

  const header = `// GENERATED by scripts/optimize-images.mjs — do not edit.
// Run \`npm run images\` to regenerate from assets-source/.

export type ImageAsset = {
  width: number;
  height: number;
  /** 20px WebP data URI, shown blurred until the real image decodes. */
  lqip: string;
  /** intrinsic width -> /img path */
  avif: Record<number, string>;
  webp: Record<number, string>;
  /** JPEG (photos) or PNG (logos) for browsers without AVIF/WebP. */
  fallback: string;
};

export const images = ${JSON.stringify(manifest, null, 2)} as const satisfies Record<string, ImageAsset>;

export type ImageName = keyof typeof images;
`;
  await writeFile(MANIFEST, header, 'utf8');

  const files = await readdir(OUT);
  console.log(
    `\n${files.length} files in ${OUT}. ${(totalIn / 1024 / 1024).toFixed(1)} MB in -> ${(totalOut / 1024).toFixed(0)} KB out.`
  );
  console.log(`Manifest: ${MANIFEST}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
