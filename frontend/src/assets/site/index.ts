/**
 * Website art, exported from the Figma file (Faith Tribe — Design System & App).
 *
 * These live in src/ rather than public/img/ on purpose: `npm run images` empties
 * public/img/ before it regenerates, so anything placed there by hand is deleted
 * on the next run. Imported from here, Vite fingerprints each file for
 * long-term caching.
 *
 * - objects/        3D objects (3dicons, CC0). Re-encoded from Figma's 400x400
 *                   PNG export to WebP at the same size: 731KB -> 110KB.
 * - logos/          The two seals with real alpha. The copies in public/img/
 *                   sit on opaque squares, so they cannot go on a tinted page.
 * - avatars/        Stand-ins. Swap for real member photos when there are any.
 * - illustrations/  Open Doodles (CC0). Stand-ins for commissioned drawings.
 *
 * The event photographs are not here. They are img2, img3 and img5 from the
 * image pipeline and render through <ResponsiveImage>.
 */
import bell from './objects/bell.webp';
import chatBubble from './objects/chat-bubble.webp';
import crown from './objects/crown.webp';
import fire from './objects/fire.webp';
import notebook from './objects/notebook.webp';
import rocket from './objects/rocket.webp';
import star from './objects/star.webp';
import target from './objects/target.webp';
import thumbUp from './objects/thumb-up.webp';

import amaka from './avatars/amaka.png';
import chidi from './avatars/chidi.png';
import ngozi from './avatars/ngozi.png';
import tolu from './avatars/tolu.png';
import tunde from './avatars/tunde.png';
import zainab from './avatars/zainab.png';

import dancing from './illustrations/dancing.svg';
import groovy from './illustrations/groovy.svg';
import heroEllipse from './illustrations/hero-ellipse.svg';
import meditating from './illustrations/meditating.svg';
import reading from './illustrations/reading.svg';
import readingSide from './illustrations/reading-side.svg';
import selfie from './illustrations/selfie.svg';

import faithTribeLogo from './logos/faith-tribe.webp';
import rccgLogo from './logos/rccg.webp';

export const OBJECTS = { bell, chatBubble, crown, fire, notebook, rocket, star, target, thumbUp } as const;

export const AVATARS = { amaka, chidi, ngozi, tolu, tunde, zainab } as const;

export const LOGOS = { faithTribe: faithTribeLogo, rccg: rccgLogo } as const;

/**
 * Each drawing sits inside a square art box. `inset` is how far Figma pulls it
 * in from that box's edges, which is what gives every drawing its own
 * proportions without stretching it.
 */
export type Illustration = { src: string; inset: string };

export const ILLUSTRATIONS = {
  dancing: { src: dancing, inset: '11.98% 5%' },
  groovy: { src: groovy, inset: '13.27% 5%' },
  meditating: { src: meditating, inset: '15.42% 5%' },
  reading: { src: reading, inset: '5% 11.14%' },
  readingSide: { src: readingSide, inset: '22.15% 5%' },
  selfie: { src: selfie, inset: '5% 18.46%' },
} as const satisfies Record<string, Illustration>;

export { heroEllipse };
