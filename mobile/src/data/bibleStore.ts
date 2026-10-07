import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

import type { ScriptureLookup } from '../api/types';

/**
 * Scripture, kept on the phone.
 *
 * Bible text never changes, so a chapter that has been fetched once has no
 * reason to be fetched again: not next week, not after the app restarts, not
 * with no signal. Each chapter is written to its own small file the first time
 * it is read, and every later read comes from that file.
 *
 * Files rather than AsyncStorage on purpose. AsyncStorage on Android is capped
 * at 6 MB for the whole app, and one translation is over 4 MB of text; a teen
 * who reads widely in two translations would hit the cap and start losing
 * writes silently. The document directory has no such cap and is not cleared
 * by the system when the phone runs low on space.
 *
 * Everything here fails soft. A read that cannot be done is a miss, and the
 * caller asks the server; a write that cannot be done is skipped, and the
 * chapter is fetched again next time. Storage trouble must never be the reason
 * a teen cannot open the Bible.
 */

/** No file system in the web preview; every call there is a quiet miss. */
const AVAILABLE = Platform.OS === 'ios' || Platform.OS === 'android';

/** Bump when the saved shape changes, so old files are ignored, not misread. */
const VERSION = 1;

const ROOT = 'bible';
const DEFAULT_KEY = 'default-translation';

function folder(...parts: string[]): Directory {
  return new Directory(Paths.document, ROOT, `v${VERSION}`, ...parts);
}

/** Letters, digits and dashes only: a code or book name becomes a safe file name. */
function safe(part: string): string {
  return part.replace(/[^A-Za-z0-9-]/g, '_');
}

async function read<T>(file: File): Promise<T | null> {
  if (!AVAILABLE) return null;
  try {
    if (!file.exists) return null;
    return JSON.parse(await file.text()) as T;
  } catch {
    // Missing, half-written or unreadable: all the same to the caller.
    return null;
  }
}

function write(dir: Directory, name: string, value: unknown): void {
  if (!AVAILABLE) return;
  try {
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const file = new File(dir, name);
    if (!file.exists) file.create();
    file.write(JSON.stringify(value));
  } catch {
    // Out of space, or the folder vanished. Fetched again next time.
  }
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
  const saved = await read<{ code: string }>(new File(folder(), `${DEFAULT_KEY}.json`));
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
  const saved = await read<ScriptureLookup>(
    new File(folder(safe(code)), `${safe(book)}-${chapter}.json`),
  );
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
  write(folder(safe(code)), `${safe(lookup.book)}-${lookup.chapter}.json`, lookup);
  if (asDefault) write(folder(), `${DEFAULT_KEY}.json`, { code });
}

// ─── Lists ─────────────────────────────────────────────────────────────────

/** A saved list (the books, the translations), or null if never fetched. */
export function readList<T>(name: string): Promise<T | null> {
  return read<T>(new File(folder(), `${safe(name)}.json`));
}

export function writeList(name: string, value: unknown): void {
  write(folder(), `${safe(name)}.json`, value);
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

/** Read a downloaded pack file. Null if it is not a pack. */
export async function readPack(file: File): Promise<TranslationPack | null> {
  const pack = await read<TranslationPack>(file);
  return pack?.translation?.code && Array.isArray(pack.books) ? pack : null;
}

/**
 * File one book of a pack away, chapter by chapter, in exactly the form a
 * chapter has when it was read normally. The reader cannot tell the two apart,
 * and a chapter saved either way is never fetched again.
 *
 * A reference is put together here ("John 3:16") in the same way the server's
 * models do it, since the pack leaves them out to save a megabyte of download.
 */
export function savePackBook(pack: TranslationPack, book: TranslationPack['books'][number]): void {
  const code = pack.translation.code;
  const dir = folder(safe(code));
  for (const chapter of book.chapters) {
    if (chapter.verses.length === 0) continue;
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
    write(dir, `${safe(book.osis)}-${chapter.number}.json`, lookup);
  }
}

/** A place for the download itself, removed once it has been filed away. */
export function packFile(code: string): File {
  return new File(folder(), `_download-${safe(code)}.json`);
}

export function ensureFolder(): void {
  if (!AVAILABLE) return;
  try {
    const dir = folder();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  } catch {
    // The download will fail and say so.
  }
}

export function markTranslationSaved(code: string): void {
  write(folder(safe(code)), '_complete.json', { at: Date.now() });
}

/** Whether every book of a translation is on this phone. */
export async function translationSaved(code: string): Promise<boolean> {
  return (await read(new File(folder(safe(code)), '_complete.json'))) !== null;
}
