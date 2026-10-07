import { AppState } from 'react-native';
import { dehydrate, hydrate, type Query, type QueryClient } from '@tanstack/react-query';

import { readJson, removeJson, writeJson } from '../data/disk';

/**
 * What the app loaded, remembered between launches.
 *
 * Without this the app forgot everything each time it closed, and every launch
 * began with the same dozen requests for things that had not changed: today's
 * reading, the profile, the streak, the events list. On a metered connection
 * that is data spent to redraw yesterday's screen, and on a slow one it is a
 * splash screen followed by skeletons.
 *
 * Now the cache is saved as it changes (`data/disk.ts`: a file in the app,
 * IndexedDB in the browser) and read back at launch,
 * before the first screen draws. A screen shows what it showed last time at
 * once, and only what has gone stale by its own rule (five minutes for a
 * profile, ten for the library) is fetched again, quietly, behind it.
 *
 * Nothing here decides what is fresh. Each saved answer keeps the time it was
 * fetched, and the same `staleTime` rules that apply in memory apply to it.
 */

/** Bump when the shape of any saved answer changes. Old files are then ignored. */
const VERSION = 1;
/** A phone unused for longer than this starts clean instead of from old news. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * How long after the last change the file is written. Each write turns the
 * whole cache into text on the thread that also draws the screen, so it waits
 * for a quiet moment. Going to the background writes at once regardless.
 */
const WRITE_AFTER_MS = 5000;

interface Saved {
  version: number;
  at: number;
  state: ReturnType<typeof dehydrate>;
}

const PATH = ['cache', `queries-v${VERSION}`];

/**
 * What is worth keeping, and what must not be kept.
 *
 * - **Scripture** has its own store (`data/bibleStore.ts`), a file per chapter.
 *   Keeping it here as well would double it and bloat a file that is rewritten
 *   on every change.
 * - **Searches** are answers to a moment's question, not something to reopen.
 * - **Teacher tools** are left out on purpose. A class list holds other teens'
 *   names and a guardian's phone number. That may sit in memory while a leader
 *   is using it; it is not written to a phone's storage.
 */
function worthKeeping(query: Query): boolean {
  if (query.state.status !== 'success') return false;
  const [root] = query.queryKey;
  if (root === 'bible' || root === 'console' || root === 'church') return false;
  return !query.queryKey.includes('search');
}

/** Read the saved cache into `client`. Call once, before anything renders. */
export async function restoreQueries(client: QueryClient): Promise<void> {
  try {
    const saved = await readJson<Saved>(PATH);
    if (!saved || saved.version !== VERSION || Date.now() - saved.at > MAX_AGE_MS) return;
    hydrate(client, saved.state);
  } catch {
    // Saved in a shape this version cannot use: the same as nothing saved.
  }
}

function write(client: QueryClient): void {
  const saved: Saved = {
    version: VERSION,
    at: Date.now(),
    state: dehydrate(client, { shouldDehydrateQuery: worthKeeping }),
  };
  writeJson(PATH, saved);
}

/**
 * Keep the file in step with the cache. Returns a function that stops.
 *
 * Writes are gathered: a screen that loads five things at once causes one
 * write a moment later, not five. The app going to the background writes
 * straight away, since that is often the last thing that happens before the
 * system closes it.
 */
export function watchQueries(client: QueryClient): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    write(client);
  };

  const unsubscribe = client.getQueryCache().subscribe((event) => {
    // Only a change in what is held matters, not who is watching it.
    if (event.type !== 'updated' && event.type !== 'removed') return;
    if (event.type === 'updated' && event.action.type !== 'success') return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, WRITE_AFTER_MS);
  });

  const appState = AppState.addEventListener('change', (status) => {
    if (status !== 'active' && timer) flush();
  });

  return () => {
    unsubscribe();
    appState.remove();
    if (timer) clearTimeout(timer);
  };
}

/**
 * Throw the saved cache away.
 *
 * Called whenever who is signed in changes. Guest and member get different
 * answers from the same addresses, and one teen's saved screens must never be
 * what the next person to pick up the phone sees.
 */
export function forgetQueries(): void {
  removeJson(PATH);
}
