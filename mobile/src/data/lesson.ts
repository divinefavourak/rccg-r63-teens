import type { ManualDetail } from '../api/types';

/**
 * Turns a teaching manual into what the lesson screen draws.
 *
 * A manual is stored as a handful of long fields written in an editor on a
 * desk. A teacher holds a phone in one hand in front of a class, so the screen
 * walks through it a part at a time ("Part 2 of 5") instead of presenting one
 * long scroll. This file is where the fields become those parts.
 */

export interface LessonPart {
  /** The small label above the title: "Opening", "The lesson". */
  eyebrow: string;
  title: string;
  paragraphs: string[];
  bullets: string[];
  /** Draw the memory verse under this part. */
  withVerse: boolean;
}

export interface LessonQuestion {
  ask: string;
  /** What a good answer sounds like, when the manual gives one. */
  listenFor: string | null;
}

/**
 * The manual's JSON lists are mostly strings, but the web editor has also
 * saved small objects (`{ question, answer }`, `{ title, description }`).
 * Either becomes one line of text; anything unrecognisable is dropped rather
 * than shown as `[object Object]`.
 */
export function lineOf(item: unknown): string {
  if (typeof item === 'string') return plain(item);
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>;
    for (const key of ['text', 'question', 'title', 'name', 'point', 'content']) {
      if (typeof o[key] === 'string' && o[key]) return plain(o[key] as string);
    }
  }
  return '';
}

function lines(items: unknown): string[] {
  return Array.isArray(items) ? items.map(lineOf).filter(Boolean) : [];
}

/**
 * Markdown marks, removed. The lesson is read aloud from large type; a stray
 * `**` or `#` on screen is noise, and nothing here needs a link to work.
 */
export function plain(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|\*|_|`)/g, '')
    .replace(/^\s*>\s?/gm, '')
    .trim();
}

/** Blank-line-separated paragraphs. Single newlines inside one are kept as spaces. */
export function paragraphs(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n\s*\n/)
    .map((block) => plain(block.replace(/\s*\n\s*/g, ' ')))
    .filter(Boolean);
}

/** `- item`, `* item` and `1. item` lines become bullets; the rest stay prose. */
function splitBullets(text: string): { paragraphs: string[]; bullets: string[] } {
  const prose: string[] = [];
  const bullets: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length) prose.push(...paragraphs(run.join('\n')));
    run = [];
  };

  for (const line of text.split('\n')) {
    const bullet = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (bullet) {
      flush();
      const item = plain(bullet[1]);
      if (item) bullets.push(item);
    } else {
      run.push(line);
    }
  }
  flush();
  return { paragraphs: prose, bullets };
}

/**
 * The main lesson text, cut at its headings.
 *
 * A manual written with `## The story`, `## What it means` reads as one part
 * per heading. One written as a single block of prose stays one part, titled
 * with the lesson's theme.
 */
function contentParts(manual: ManualDetail): LessonPart[] {
  const text = (manual.lesson_content ?? '').replace(/\r\n/g, '\n');
  if (!text.trim()) return [];

  const sections: { title: string; body: string[] }[] = [];
  let current: { title: string; body: string[] } = { title: '', body: [] };
  for (const line of text.split('\n')) {
    const heading = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      if (current.title || current.body.join('').trim()) sections.push(current);
      current = { title: plain(heading[1]), body: [] };
    } else {
      current.body.push(line);
    }
  }
  if (current.title || current.body.join('').trim()) sections.push(current);

  return sections.map((section, i) => ({
    eyebrow: 'The lesson',
    title: section.title || (i === 0 ? manual.theme || manual.title : manual.title),
    ...splitBullets(section.body.join('\n')),
    withVerse: i === 0,
  }));
}

/** The lesson as an ordered walk. Parts with nothing in them are left out. */
export function lessonParts(manual: ManualDetail): LessonPart[] {
  const parts: LessonPart[] = [];
  const part = (
    eyebrow: string,
    title: string,
    body: { paragraphs?: string[]; bullets?: string[] },
  ) => {
    const paragraphsOf = body.paragraphs ?? [];
    const bulletsOf = body.bullets ?? [];
    if (paragraphsOf.length || bulletsOf.length) {
      parts.push({ eyebrow, title, paragraphs: paragraphsOf, bullets: bulletsOf, withVerse: false });
    }
  };

  part('Opening', 'Start with prayer', { bullets: lines(manual.opening_prayer_points) });
  part('Opening', 'Where this is going', { bullets: lines(manual.lesson_objectives) });
  parts.push(...contentParts(manual));
  part('Remember', 'What to take home', { bullets: lines(manual.key_takeaways) });
  part('Live it', 'This week', splitBullets(manual.practical_application ?? ''));
  part('Closing', 'Close in prayer', { paragraphs: paragraphs(manual.closing_prayer) });

  // A manual with a memory verse and no lesson text still shows the verse.
  if (parts.length && !parts.some((p) => p.withVerse)) parts[0].withVerse = true;
  return parts;
}

/** Discussion questions, with the answer to listen for when the manual has one. */
export function lessonQuestions(manual: ManualDetail): LessonQuestion[] {
  if (!Array.isArray(manual.discussion_questions)) return [];
  return manual.discussion_questions
    .map((item): LessonQuestion => {
      const ask = lineOf(item);
      let listenFor: string | null = null;
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        for (const key of ['answer', 'listen_for', 'guide', 'hint', 'notes']) {
          if (typeof o[key] === 'string' && o[key]) {
            listenFor = plain(o[key] as string);
            break;
          }
        }
      }
      return { ask, listenFor };
    })
    .filter((q) => q.ask);
}

export interface LessonActivity {
  title: string;
  detail: string | null;
}

export function lessonActivities(manual: ManualDetail): LessonActivity[] {
  if (!Array.isArray(manual.activity_suggestions)) return [];
  return manual.activity_suggestions
    .map((item): LessonActivity => {
      let detail: string | null = null;
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        for (const key of ['description', 'materials', 'detail', 'instructions']) {
          if (typeof o[key] === 'string' && o[key]) {
            detail = plain(o[key] as string);
            break;
          }
        }
      }
      return { title: lineOf(item), detail };
    })
    .filter((a) => a.title);
}

/** Extra resources: a label, and a link when the manual gives one. */
export function lessonResources(manual: ManualDetail): { label: string; url: string | null }[] {
  if (!Array.isArray(manual.teacher_resources)) return [];
  return manual.teacher_resources
    .map((item) => {
      if (typeof item === 'string') {
        return /^https?:\/\//.test(item) ? { label: item, url: item } : { label: item, url: null };
      }
      const o = (item ?? {}) as Record<string, unknown>;
      const url = typeof o.url === 'string' ? o.url : typeof o.link === 'string' ? o.link : null;
      return { label: lineOf(item) || url || '', url };
    })
    .filter((r) => r.label);
}

/** Does the teacher's half of this manual have anything in it? */
export function hasTeacherNotes(manual: ManualDetail): boolean {
  return (
    paragraphs(manual.teacher_notes).length > 0 ||
    paragraphs(manual.discussion_guide).length > 0 ||
    lessonActivities(manual).length > 0 ||
    lessonResources(manual).length > 0
  );
}
