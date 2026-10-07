import { useSyncExternalStore } from 'react';

import { markTranslationSaved, savePackBook, translationSaved } from '../data/bibleStore';
import { fetchPack } from '../data/packFetch';

/**
 * Keeping a whole translation on the phone.
 *
 * Reading already saves each chapter as it is opened. This fetches the rest in
 * one go, so a teen with data today can read anything tomorrow with none.
 *
 * **One download.** The server keeps each translation ready as a single file
 * and `fetchPack` fetches it in one request: with the phone's own downloader in
 * the app, with an ordinary request in the browser.
 *
 * **Then filed away, a book at a time.** The download is one big file; the
 * reader wants one small file per chapter. Splitting it is done in steps with a
 * pause between books, so the app stays responsive and the bar can move.
 *
 * The state lives here, outside any screen, on purpose: the download is started
 * from a sheet that closes, and it has to carry on and still be reportable when
 * the sheet is opened again.
 */

export type DownloadState =
  /** Not on this phone, or only the chapters that have been read. */
  | { status: 'none' }
  /** Fetching the file. The phone's downloader gives no running total. */
  | { status: 'fetching' }
  /** Splitting it into chapters. */
  | { status: 'saving'; done: number; total: number }
  | { status: 'saved' }
  | { status: 'stopped'; message: string };

const NONE: DownloadState = { status: 'none' };

const states = new Map<string, DownloadState>();
const listeners = new Set<() => void>();
/** Translations with a download running, so a second tap does not start another. */
const running = new Set<string>();

function set(code: string, state: DownloadState): void {
  states.set(code, state);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Whether a translation is on this phone. Looks on the phone the first time it
 * is asked about each one, then follows any download that runs.
 */
export function useDownloadState(code: string | undefined): DownloadState {
  const state = useSyncExternalStore(subscribe, () => (code ? (states.get(code) ?? NONE) : NONE));

  if (code && !states.has(code)) {
    // Set straight away so this lookup happens once, not on every render.
    states.set(code, NONE);
    translationSaved(code).then((saved) => {
      if (saved && !running.has(code)) set(code, { status: 'saved' });
    });
  }
  return state;
}

/** Let the screen draw: between books, and every few chapters within one. */
const breathe = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Fetch all of `code` and file it away. Safe to call again after a failure. */
export async function downloadTranslation(code: string): Promise<void> {
  if (running.has(code)) return;
  running.add(code);
  set(code, { status: 'fetching' });

  try {
    const pack = await fetchPack(code);

    const total = pack.books.length;
    for (let i = 0; i < total; i++) {
      await savePackBook(pack, pack.books[i], breathe);
      set(code, { status: 'saving', done: i + 1, total });
      await breathe();
    }

    markTranslationSaved(code);
    set(code, { status: 'saved' });
  } catch (error) {
    const text = String((error as Error)?.message ?? error);
    set(code, {
      status: 'stopped',
      message: text.includes('403')
        ? `${code} can be read here, but its licence does not allow keeping it on a phone.`
        : 'That did not finish. Check your connection and try again.',
    });
  } finally {
    running.delete(code);
  }
}
