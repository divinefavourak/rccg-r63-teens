import type { ScriptureLookup } from '../api/types';
import { readJson, writeJson } from './disk';

/**
 * Scripture, kept on the phone.
 *
 * Bible text never changes, so a chapter that has been fetched once has no
 * reason to be fetched again: not next week, not after the app restarts, not
 * with no signal. Each chapter is saved on its own the first time it is read,
 * and every later read comes from that copy.
 *
 * Where it is kept is `disk.ts`'s business: files in the app, IndexedDB in the
 * browser. Neither is AsyncStorage, on purpose. That is capped at 6 MB for the
 * whole app on Android and about 5 MB in a browser, and one translation is over
 * 4 MB of text; a teen who reads widely in two translations would hit the cap
 * and start losing writes silently.
 *
 * Everything here fails soft. A read that cannot be done is a miss, and the
 * caller asks the server; a write that cannot be done is skipped, and the
 * chapter is fetched again next time. Storage trouble must never be the reason
 * a teen cannot open the Bible.
 */

/** Bump when the saved shape changes, so old copies are ignored, not misread. */
const VERSION = 1;

const ROOT = ['bible', `v${VERSION}`];
const DEFAULT_KEY = 'default-translation';

/** Letters, digits and dashes only: a code or book name becomes a safe file name. */
function safe(part: string): string {
  return part.replace(/[^A-Za-z0-9-]/g, '_');
}

// ─── Chapters ──────────────────────────────────────────────────────────────

/**
 * The code of the translation the server treats as the default.
 *
 * The reader usually asks for "the default" without naming it, and the phone
 * only learns which one that is from the first answer. It is remembered here
 * so the next unnamed request can be served from the phone too.
 */
async function defaultTranslation(): Promise<string | null> {
  const saved = await readJson<{ code: string }>([...ROOT, DEFAULT_KEY]);
  return saved?.code ?? null;
}

/** A saved chapter, or null if this phone has never fetched it. */
export async function readChapter(
  book: string,
  chapter: number,
  translation?: string,
): Promise<ScriptureLookup | null> {
  const code = translation ?? (await defaultTranslation());
  if (!code) return null;
  const saved = await readJson<ScriptureLookup>([...ROOT, safe(code), `${safe(book)}-${chapter}`]);
  // A chapter with no verses is "not imported yet", which may stop being true.
  return saved && saved.verses.length > 0 ? saved : null;
}

/**
 * Keep a chapter the server just sent.
 *
 * `asDefault` records that this translation is what an unnamed request gets.
 */
export function writeChapter(lookup: ScriptureLookup, asDefault: boolean): void {
  if (!lookup.translation?.code || lookup.verses.length === 0) return;
  const code = lookup.translation.code;
  writeJson([...ROOT, safe(code), `${safe(lookup.book)}-${lookup.chapter}`], lookup);
  if (asDefault) writeJson([...ROOT, DEFAULT_KEY], { code });
}

// ─── Lists ─────────────────────────────────────────────────────────────────

/** A saved list (the books, the translations), or null if never fetched. */
export function readList<T>(name: string): Promise<T | null> {
  return readJson<T>([...ROOT, safe(name)]);
}

export function writeList(name: string, value: unknown): void {
  writeJson([...ROOT, safe(name)], value);
}

// ─── A whole translation ───────────────────────────────────────────────────

/** A whole translation as the server packs it (backend `bible/packs.py`). */
export interface TranslationPack {
  translation: ScriptureLookup['translation'];
  books: {
    osis: string;
    name: string;
    /** Each verse is `[number, id, text]`: compact, because it is downloaded. */
    chapters: { id: string; number: number; verses: [number, string, string][] }[];
  }[];
}

/** Whether something downloaded really is a pack. */
export function isPack(value: unknown): value is TranslationPack {
  const pack = value as TranslationPack | null;
  return !!pack?.translation?.code && Array.isArray(pack.books);
}

/**
 * File one book of a pack away, chapter by chapter, in exactly the form a
 * chapter has when it was read normally. The reader cannot tell the two apart,
 * and a chapter saved either way is never fetched again.
 *
 * A reference is put together here ("John 3:16") in the same way the server's
 * models do it, since the pack leaves them out to save a megabyte of download.
 */
export async function savePackBook(
  pack: TranslationPack,
  book: TranslationPack['books'][number],
  /** Called every few chapters so the screen can draw; Psalms alone is 150 files. */
  pause?: () => Promise<void>,
): Promise<void> {
  const code = pack.translation.code;
  const dir = [...ROOT, safe(code)];
  let written = 0;
  for (const chapter of book.chapters) {
    if (chapter.verses.length === 0) continue;
    if (pause && ++written % 10 === 0) await pause();
    const lookup: ScriptureLookup = {
      translation: pack.translation,
      book: book.osis,
      book_name: book.name,
      chapter: chapter.number,
      start_verse: null,
      end_verse: null,
      reference: `${book.name} ${chapter.number}`,
      verses: chapter.verses.map(([number, id, text]) => ({
        id,
        chapter: chapter.id,
        number,
        text,
        reference: `${book.name} ${chapter.number}:${number}`,
      })),
    };
    writeJson([...dir, `${safe(book.osis)}-${chapter.number}`], lookup);
  }
}

export function markTranslationSaved(code: string): void {
  writeJson([...ROOT, safe(code), '_complete'], { at: Date.now() });
}

/** Whether every book of a translation is on this phone. */
export async function translationSaved(code: string): Promise<boolean> {
  return (await readJson([...ROOT, safe(code), '_complete'])) !== null;
}
