/**
 * `disk.ts` for the browser: the same three functions, kept in IndexedDB.
 *
 * IndexedDB rather than localStorage because localStorage is capped at about
 * 5 MB for the whole site and one Bible translation is over 4 MB. A site added
 * to an iPhone's Home Screen also keeps its IndexedDB; Safari only clears the
 * storage of sites that are visited in a tab and then left for a week.
 *
 * Writes are gathered and sent together. Filing a downloaded translation away
 * is about 1,200 writes in a row, and one transaction each would take many
 * times longer than one transaction for the lot.
 */

const DB_NAME = 'faithtribe';
const STORE = 'files';

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('blocked'));
  });
  // Private browsing in some browsers refuses to open; try again next call.
  opening.catch(() => {
    opening = null;
  });
  return opening;
}

/** Written but not yet sent. `undefined` means "remove". Read before the database is. */
const pending = new Map<string, unknown>();
let flushing: ReturnType<typeof setTimeout> | null = null;

function flush(): void {
  flushing = null;
  if (pending.size === 0) return;
  const batch = [...pending];
  open()
    .then((db) => {
      const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
      for (const [key, value] of batch) {
        if (value === undefined) store.delete(key);
        else store.put(value, key);
        // Only forget it if nothing newer was written while this was queued.
        if (pending.get(key) === value) pending.delete(key);
      }
    })
    .catch(() => {
      // No database. Drop the batch, or it would be held in memory for ever.
      for (const [key, value] of batch) if (pending.get(key) === value) pending.delete(key);
    });
}

function queue(key: string, value: unknown): void {
  pending.set(key, value);
  // A page being put away may never run another timer, so send at once.
  if (document.visibilityState === 'hidden') flush();
  else if (!flushing) flushing = setTimeout(flush, 0);
}

export async function readJson<T>(path: string[]): Promise<T | null> {
  const key = path.join('/');
  if (pending.has(key)) return (pending.get(key) as T | undefined) ?? null;
  try {
    const db = await open();
    return await new Promise<T | null>((resolve) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export function writeJson(path: string[], value: unknown): void {
  queue(path.join('/'), value);
}

export function removeJson(path: string[]): void {
  queue(path.join('/'), undefined);
}
