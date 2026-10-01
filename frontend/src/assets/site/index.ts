/**
 * Website art.
 *
 * These live in src/ rather than public/img/ on purpose: `npm run images` empties
 * public/img/ before it regenerates, so anything placed there by hand is deleted
 * on the next run. Imported from here, Vite fingerprints each file for
 * long-term caching, and only the files a page actually uses are downloaded.
 *
 * - objects/        3D objects (3dicons, CC0).
 * - illustrations/  Line drawings (Open Doodles, CC0). Stand-ins until there are
 *                   commissioned drawings of Nigerian teens.
 * - logos/          The two seals with real alpha. The copies in public/img/
 *                   sit on opaque squares, so they cannot go on a tinted page.
 * - avatars/        Stand-ins. Swap for real member photos when there are any.
 *
 * Objects and drawings are a library: `npm run art` downloads them from the
 * original sources and writes library.ts, which lists everything in those two
 * folders. To add one, edit scripts/fetch-site-art.mjs. A handful came from the
 * Figma file first (the nine objects and six drawings on the landing page) and
 * the script leaves those untouched.
 *
 * The event photographs are not here. They are img2, img3 and img5 from the
 * image pipeline and render through <ResponsiveImage>.
 */
import amaka from './avatars/amaka.png';
import chidi from './avatars/chidi.png';
import ngozi from './avatars/ngozi.png';
import tolu from './avatars/tolu.png';
import tunde from './avatars/tunde.png';
import zainab from './avatars/zainab.png';

import heroEllipse from './illustrations/hero-ellipse.svg';

import faithTribeLogo from './logos/faith-tribe.webp';
import rccgLogo from './logos/rccg.webp';

export { ILLUSTRATIONS, OBJECTS, type Illustration } from './library';

export const AVATARS = { amaka, chidi, ngozi, tolu, tunde, zainab } as const;

export const LOGOS = { faithTribe: faithTribeLogo, rccg: rccgLogo } as const;

export { heroEllipse };
