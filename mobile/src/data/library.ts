import type { ArticleListItem, DevotionalListItem, MediaEpisode } from '../api/types';
import type { DrawingName } from '../ui/art';
import type { PopColour } from '../theme/tokens';

/**
 * The Library shows three different things from three endpoints — daily
 * readings, articles and media episodes — as one kind of card. This is the
 * common shape, and the one place that decides what each says about itself.
 */

/** How a teen takes it in. The Library's filter chips are these. */
export type LibraryKind = 'read' | 'watch' | 'listen';

export interface LibraryItem {
  /** Unique across all three sources. */
  key: string;
  source: 'devotional' | 'article' | 'episode';
  id: string;
  kind: LibraryKind;
  title: string;
  /** "PODCAST · 18 MIN" — the small label over the title. */
  eyebrow: string;
  /** One line under the title: a series, a topic or a passage. */
  detail: string | null;
  /** "Real Talk · 18 min" — the line under a shelf tile. */
  caption: string;
  image: string | null;
  colour: PopColour;
  drawing: DrawingName;
  /** For newest-first ordering across sources. */
  when: number;
  featured: boolean;
  /** Present on episodes, which the player needs whole. */
  episode?: MediaEpisode;
}

const COLOURS: PopColour[] = ['amber', 'sky', 'pink', 'lime', 'violet'];
const DRAWINGS: DrawingName[] = [
  'dancing',
  'meditating',
  'groovy',
  'sitting-reading',
  'loving',
  'reading',
  'jumping',
];

/**
 * A steady number from an id, so an item with no cover keeps the same colour
 * and drawing every time it is shown.
 */
function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function look(id: string): { colour: PopColour; drawing: DrawingName } {
  const h = hash(id);
  return { colour: COLOURS[h % COLOURS.length], drawing: DRAWINGS[h % DRAWINGS.length] };
}

function time(iso: string | null | undefined): number {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
}

/** "18 min", or "1 hr 5 min". Null when the length is not known. */
export function minutesLabel(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} hr ${rest} min` : `${Math.floor(minutes / 60)} hr`;
}

const CATEGORY: Record<string, string> = {
  faith: 'Faith',
  relationships: 'Relationships',
  education: 'School and career',
  health: 'Health',
  lifestyle: 'Lifestyle',
  testimonies: 'Testimonies',
  news: 'News',
};

export function categoryLabel(category: string | null | undefined): string | null {
  if (!category) return null;
  return CATEGORY[category] ?? category.charAt(0).toUpperCase() + category.slice(1);
}

export function fromDevotional(
  d: Pick<DevotionalListItem, 'id' | 'date' | 'title' | 'memory_verse_passage' | 'cover_image'>,
): LibraryItem {
  const date = new Date(`${d.date}T00:00:00`);
  const day = Number.isNaN(date.getTime())
    ? d.date
    : `${date.getDate()} ${date.toLocaleDateString('en-GB', { month: 'short' })}`;
  return {
    key: `devotional:${d.id}`,
    source: 'devotional',
    id: d.id,
    kind: 'read',
    title: d.title,
    eyebrow: `Reading · ${day}`,
    detail: d.memory_verse_passage,
    caption: day,
    image: d.cover_image,
    ...look(d.id),
    when: time(d.date),
    featured: false,
  };
}

export function fromArticle(a: ArticleListItem): LibraryItem {
  const minutes = a.read_time_minutes ? `${a.read_time_minutes} min read` : null;
  return {
    key: `article:${a.id}`,
    source: 'article',
    id: a.id,
    kind: 'read',
    title: a.title,
    eyebrow: minutes ? `Article · ${minutes}` : 'Article',
    detail: categoryLabel(a.category),
    caption: minutes ?? 'Article',
    image: a.cover_image,
    ...look(a.id),
    when: time(a.published_at),
    featured: a.is_featured,
  };
}

/**
 * An episode is something to listen to if it has sound, otherwise something
 * to watch. One published as both goes on the Listen shelf, where it can play
 * in the app with the screen off.
 */
export function fromEpisode(e: MediaEpisode): LibraryItem {
  const listen = e.has_audio;
  const length = minutesLabel(e.duration_seconds);
  const label = listen ? 'Podcast' : 'Video';
  return {
    key: `episode:${e.id}`,
    source: 'episode',
    id: e.id,
    kind: listen ? 'listen' : 'watch',
    title: e.title,
    eyebrow: length ? `${label} · ${length}` : label,
    detail: e.series_title || null,
    caption: [e.series_title, length].filter(Boolean).join(' · ') || label,
    image: e.thumbnail,
    ...look(e.id),
    when: time(e.published_at),
    featured: e.is_featured,
    episode: e,
  };
}

/** The verb on a button that opens an item. */
export function actionFor(kind: LibraryKind): string {
  return kind === 'listen' ? 'Listen now' : kind === 'watch' ? 'Watch now' : 'Read now';
}
