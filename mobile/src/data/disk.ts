import { Directory, File, Paths } from 'expo-file-system';

/**
 * Small JSON files kept on the phone, addressed by a path of names.
 *
 * `['bible', 'v1', 'KJV', 'John-3']` is `bible/v1/KJV/John-3.json` in the app's
 * document directory. That directory has no size cap and is not cleared by the
 * system when the phone runs low on space, which is why Scripture and the saved
 * cache live here rather than in AsyncStorage (capped at 6 MB on Android).
 *
 * In the browser the same three functions are backed by IndexedDB instead
 * (`disk.web.ts`); nothing that calls them can tell.
 *
 * Everything fails soft. A read that cannot be done is a miss and a write that
 * cannot be done is skipped: storage trouble must never be what stops a screen.
 */

function fileAt(path: string[]): { dir: Directory; file: File } {
  const dir = new Directory(Paths.document, ...path.slice(0, -1));
  return { dir, file: new File(dir, `${path[path.length - 1]}.json`) };
}

/** What was saved at `path`, or null if nothing readable is there. */
export async function readJson<T>(path: string[]): Promise<T | null> {
  try {
    const { file } = fileAt(path);
    if (!file.exists) return null;
    return JSON.parse(await file.text()) as T;
  } catch {
    // Missing, half-written or unreadable: all the same to the caller.
    return null;
  }
}

export function writeJson(path: string[], value: unknown): void {
  try {
    const { dir, file } = fileAt(path);
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    if (!file.exists) file.create();
    file.write(JSON.stringify(value));
  } catch {
    // Out of space, or the folder vanished. Fetched again next time.
  }
}

export function removeJson(path: string[]): void {
  try {
    const { file } = fileAt(path);
    if (file.exists) file.delete();
  } catch {
    // Nothing to delete, or it could not be. The next write replaces it.
  }
}
