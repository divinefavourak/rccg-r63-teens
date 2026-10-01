/**
 * Website art library. Downloads 3D objects and line drawings from their
 * original sources into src/assets/site/, then writes the typed registry at
 * src/assets/site/library.ts.
 *
 * Run with `npm run art`. It is safe to re-run: files that already exist are
 * kept, so the pieces exported from Figma are never overwritten. Pass --force
 * to download everything in the lists again.
 *
 * Both sources are CC0 (public domain, no credit required):
 *
 *   3dicons      https://3dicons.co        by vijay verma
 *   Open Doodles https://www.opendoodles.com  by Pablo Stanley
 *
 * They are the same two sets the Figma file uses, so anything added here sits
 * next to the existing art without a change of style.
 *
 * To add a piece: find it on the source site, add a line to OBJECTS or DOODLES
 * below, and run the script. Nothing else needs editing; the registry is
 * rebuilt from whatever is in the two folders.
 */
import sharp from 'sharp';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = 'src/assets/site';
const OBJECT_DIR = path.join(ROOT, 'objects');
const DOODLE_DIR = path.join(ROOT, 'illustrations');
const REGISTRY = path.join(ROOT, 'library.ts');
const FORCE = process.argv.includes('--force');

/**
 * [file name, 3dicons id]. The id is the last part of the icon's page address,
 * e.g. https://3dicons.co/icons/b91186-shield.
 *
 * "dynamic" is the three-quarter angle the Figma objects use. 500px is the
 * largest preview the site serves; it is cut out and reduced to 400px to match
 * the Figma exports.
 */
const OBJECT_URL = (id) =>
  `https://bvconuycpdvgzbvbkijl.supabase.co/storage/v1/object/public/sizes/${id}/dynamic/500/color.webp`;

const OBJECTS = [
  // Trust and safety
  ['shield', 'b91186-shield'],
  ['lock', '457612-lock'],
  ['key', '778c78-key'],
  // Documents and writing
  ['file-text', '65d841-file-text'],
  ['pencil', '66b0f8-pencil'],
  ['tick', '1b714e-tick'],
  ['bookmark', '8c0c80-bookmark'],
  ['bookmark-fav', '3d77e2-bookmark-fav'],
  // Help and conversation
  ['bulb', 'ddbd61-bulb'],
  ['chat-text', 'f0f795-chat-text'],
  ['message', '58aeba-message'],
  ['megaphone', '313578-megaphone'],
  ['zoom', 'b4a0af-zoom'],
  ['mail', '8924a0-mail'],
  ['call-in', '883904-call-in'],
  // Listening and watching
  ['headphone', 'b81ead-headphone'],
  ['music', '331e9c-music'],
  ['mic', 'fddbbc-mic'],
  ['play', '866e45-play'],
  ['video-cam', 'b1dccf-video-cam'],
  // Daily rhythm
  ['sun', '801da3-sun'],
  ['moon', 'a63030-moon'],
  ['clock', '8ef1fa-clock'],
  ['candle', '6e6a21-candle'],
  ['leaf', '2c84d9-leaf'],
  ['tea-cup', '845bf0-tea-cup'],
  // Care and celebration
  ['heart', '1acc3d-heart'],
  ['notify-heart', '196608-notify-heart'],
  ['medal', '39121b-medal'],
  ['trophy', '49654f-trophy'],
  ['cup', '7fb19c-cup'],
  ['gift', '3f0398-gift'],
  ['ribbon', 'b0b258-ribbon'],
  ['flash', '637858-flash'],
  // Events and places
  ['calendar', '781f28-calendar'],
  ['map-pin', '1858b9-map-pin'],
  ['location', '8bbd16-location'],
  ['flag', 'e9828b-flag'],
  ['travel', 'fa6099-travel'],
  ['camera', '5656e5-camera'],
  ['picture', '19312f-picture'],
  // People and devices
  ['girl', '2dfe27-girl'],
  ['boy', 'a14880-boy'],
  ['mobile', '1fded0-mobile'],
  ['wifi', '16f789-wifi'],
  ['link', '2d9fa2-link'],
  ['puzzle', 'a68576-puzzle'],
  ['color-palette', '82db59-color-palette'],
];

/** [file name, path on the Open Doodles CDN, without the "_name.svg" ending]. */
const DOODLE_URL = (name, id) => `https://cdn.prod.website-files.com/${id}_${name}.svg`;
const SET = '5d5e2ff58f10c53dcffd8683';

const DOODLES = [
  ['sitting-reading', `${SET}/5da4a2a996a90ccc56796336`],
  ['sitting', `${SET}/5d5e30af8983562001c60dc6`],
  ['laying', `${SET}/5d9d126de6b3b43d496aea9d`],
  ['chilling', `${SET}/5d5e305b898356dc76c60d38`],
  ['float', `${SET}/5d73855542881e5005f1a547`],
  ['plant', `${SET}/5d73851c7a6dfa0d4c1e8297`],
  ['loving', `${SET}/5d5e30d9898356c023c60de1`],
  ['petting', `${SET}/5d5e30ff7662019647f69be8`],
  ['strolling', `${SET}/5d5e3088cfc85e573c6fd0a6`],
  ['running', `${SET}/5d5e30d18f10c5376afd8f57`],
  ['jumping', `${SET}/5d5e30a6cfc85e5a206fd0cd`],
  ['dog-jump', `${SET}/5da4a24996a90ce569796125`],
  ['moshing', `${SET}/5d5e303faa3dfe33a1a55f8d`],
  ['ballet', `${SET}/5d9eb5c74a6e6c120e089d3d`],
  ['roller-skating', `${SET}/5d5e309c8f10c53017fd8f15`],
  ['rolling', `${SET}/5d5e3093898356dca4c60d7f`],
  ['swinging', `${SET}/5d5e3063cfc85eab966fd075`],
  ['sleek', `${SET}/5d9d0bc942118250cc830261`],
  ['clumsy', `${SET}/5d73852f7a6dfa5b3e1e829f`],
  ['unboxing', `${SET}/5d5e30797662017855f689a6`],
  ['ice-cream', `${SET}/5d5e30c18f10c55c00fd8f48`],
];

// The Figma file binds a drawing's line to color/text/primary and its accent to
// brand green. The originals are black with a pink accent, so they are
// recoloured the same way here. Keep these two in step with src/styles/site.css.
const INK = '#1C1916';
const ACCENT = '#10B981';

const get = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
};

/**
 * Makes an original Open Doodles file match the ones exported from Figma:
 * brand colours, and a viewBox cropped to the drawing itself.
 *
 * The crop matters. The originals sit on a 1024x768 canvas with empty space
 * around them, and a different amount for each drawing. <Art> sizes a drawing
 * from its width and height, so that space would make them all look small and
 * off-centre.
 */
async function normaliseDoodle(source) {
  let svg = source
    .toString('utf8')
    .replace(/<\?xml[^>]*\?>/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<desc>[\s\S]*?<\/desc>/, '')
    .replace(/<rect id="Background"[^>]*><\/rect>/, '');

  svg = svg.replace(/#[0-9a-fA-F]{6}\b/g, (hex) => {
    const value = hex.toUpperCase();
    if (value === '#000000') return INK;
    if (value === '#FFFFFF') return value;
    return ACCENT;
  });

  // Rasterise once to find where the ink actually is.
  const { info } = await sharp(Buffer.from(svg)).trim().toBuffer({ resolveWithObject: true });
  const pad = 2;
  const x = -info.trimOffsetLeft - pad;
  const y = -info.trimOffsetTop - pad;
  const w = info.width + pad * 2;
  const h = info.height + pad * 2;

  // preserveAspectRatio="none" matches the Figma exports: <Art> gives the image
  // a box of exactly the right proportions and lets it fill it.
  return svg
    .replace(
      /<svg[^>]*>/,
      `<svg preserveAspectRatio="none" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">`,
    )
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

/**
 * Cuts a 3dicons preview out of its white background.
 *
 * The site serves previews flattened onto white. Its transparent PNGs sit
 * behind the download button, which a script cannot use, so the background is
 * removed here instead.
 *
 * Only white that touches the edge of the image is removed (a flood fill from
 * the border). White inside an object, such as a candle or a phone screen, is
 * not connected to the edge and stays. The pixels along the cut were blended
 * with white when the preview was rendered, so that white is taken back out of
 * them; otherwise every object would carry a pale fringe on a coloured card.
 */
async function cutOut(source) {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const at = (x, y) => (y * width + x) * 4;
  const NEAR_WHITE = 247;
  const isWhite = (i) => data[i] >= NEAR_WHITE && data[i + 1] >= NEAR_WHITE && data[i + 2] >= NEAR_WHITE;

  // 1. Flood fill from the border through near-white pixels.
  const background = new Uint8Array(width * height);
  const queue = [];
  const visit = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (background[p] || !isWhite(p * 4)) return;
    background[p] = 1;
    queue.push(p);
  };
  for (let x = 0; x < width; x++) (visit(x, 0), visit(x, height - 1));
  for (let y = 0; y < height; y++) (visit(0, y), visit(width - 1, y));
  while (queue.length) {
    const p = queue.pop();
    const x = p % width;
    const y = (p - x) / width;
    visit(x + 1, y), visit(x - 1, y), visit(x, y + 1), visit(x, y - 1);
  }

  // 2. Clear the background, and un-blend white from the two pixels beside it.
  const nearBackground = (x, y) => {
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && background[ny * width + nx]) return true;
      }
    return false;
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = at(x, y);
      if (background[y * width + x]) {
        data[i + 3] = 0;
        continue;
      }
      if (!nearBackground(x, y)) continue;
      // Colour-to-alpha against white: the least white channel sets how solid
      // the pixel really was, and the colour is recovered from that.
      const alpha = Math.max(255 - data[i], 255 - data[i + 1], 255 - data[i + 2]) / 255;
      if (alpha >= 1) continue;
      if (alpha <= 0) {
        data[i + 3] = 0;
        continue;
      }
      for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.round((data[i + c] - 255 * (1 - alpha)) / alpha));
      data[i + 3] = Math.round(alpha * 255);
    }

  return sharp(data, { raw: { width, height, channels: 4 } })
    .resize(400, 400)
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toBuffer();
}

const camel = (name) => name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const percent = (n) => `${Number(n.toFixed(2))}%`;

/**
 * How far a drawing is pulled in from the edges of its square art box: 5% on
 * its longer side, and whatever centres it on the shorter one. This is the rule
 * Figma applies, so it reproduces the insets of the exported drawings exactly.
 */
function insetFor(width, height) {
  const ratio = width / height;
  const margin = 5;
  const span = 100 - margin * 2;
  return ratio >= 1
    ? `${percent((100 - span / ratio) / 2)} ${percent(margin)}`
    : `${percent(margin)} ${percent((100 - span * ratio) / 2)}`;
}

async function download(list, dir, extension, toUrl, transform) {
  let added = 0;
  for (const [name, id] of list) {
    const file = path.join(dir, `${name}.${extension}`);
    if (existsSync(file) && !FORCE) continue;
    try {
      const source = await get(toUrl(name, id));
      await writeFile(file, transform ? await transform(source) : source);
      added += 1;
      console.log(`  + ${file}`);
    } catch (error) {
      // One missing file should not stop the rest. It is reported and skipped.
      console.warn(`  ! ${name}: ${error.message}`);
    }
  }
  return added;
}

async function writeRegistry() {
  const objects = (await readdir(OBJECT_DIR)).filter((f) => f.endsWith('.webp')).sort();
  // hero-ellipse.svg is a background shape, not a drawing.
  const doodles = (await readdir(DOODLE_DIR)).filter((f) => f.endsWith('.svg') && f !== 'hero-ellipse.svg').sort();

  const lines = [
    '// GENERATED by scripts/fetch-site-art.mjs — do not edit.',
    '// Run `npm run art` after adding a piece to that script.',
    '',
  ];

  for (const f of objects) lines.push(`import object_${camel(f.replace('.webp', ''))} from './objects/${f}';`);
  lines.push('');
  for (const f of doodles) lines.push(`import doodle_${camel(f.replace('.svg', ''))} from './illustrations/${f}';`);

  lines.push(
    '',
    '/** 3D objects (3dicons, CC0). 400x400 WebP. */',
    'export const OBJECTS = {',
    ...objects.map((f) => {
      const key = camel(f.replace('.webp', ''));
      return `  ${key}: object_${key},`;
    }),
    '} as const;',
    '',
    '/**',
    ' * Each drawing sits inside a square art box. `inset` is how far it is pulled in',
    ' * from that box’s edges, which is what gives every drawing its own proportions',
    ' * without stretching it.',
    ' */',
    'export type Illustration = { src: string; inset: string };',
    '',
    '/** Line drawings (Open Doodles, CC0), in the brand ink and green. */',
    'export const ILLUSTRATIONS = {',
  );

  for (const f of doodles) {
    const svg = await readFile(path.join(DOODLE_DIR, f), 'utf8');
    const width = Number(svg.match(/<svg[^>]*\swidth="([\d.]+)"/)?.[1]);
    const height = Number(svg.match(/<svg[^>]*\sheight="([\d.]+)"/)?.[1]);
    if (!width || !height) throw new Error(`${f} has no width/height on its <svg> tag`);
    const key = camel(f.replace('.svg', ''));
    lines.push(`  ${key}: { src: doodle_${key}, inset: '${insetFor(width, height)}' },`);
  }

  lines.push('} as const satisfies Record<string, Illustration>;', '');
  await writeFile(REGISTRY, lines.join('\n'), 'utf8');
  return { objects: objects.length, doodles: doodles.length };
}

async function run() {
  await mkdir(OBJECT_DIR, { recursive: true });
  await mkdir(DOODLE_DIR, { recursive: true });

  console.log('3D objects (3dicons)');
  const newObjects = await download(OBJECTS, OBJECT_DIR, 'webp', (_, id) => OBJECT_URL(id), cutOut);
  console.log('Drawings (Open Doodles)');
  const newDoodles = await download(DOODLES, DOODLE_DIR, 'svg', DOODLE_URL, normaliseDoodle);

  const total = await writeRegistry();
  console.log(
    `\nAdded ${newObjects} objects and ${newDoodles} drawings. Library now holds ${total.objects} objects and ${total.doodles} drawings.`,
  );
  console.log(`Registry: ${REGISTRY}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
