import { Directory, File, Paths } from 'expo-file-system';

import { API_URL } from '../api/config';
import { isPack, type TranslationPack } from './bibleStore';

/**
 * Fetch a whole translation in one request.
 *
 * The phone's own downloader writes it straight to storage, so nothing that
 * size passes through the app's memory on the way and the app's request
 * timeouts do not apply to it. The file is only a staging post: it is read,
 * handed back, and removed.
 *
 * Throws when the download fails. A refusal on licence grounds has `403` in
 * the message. (`packFetch.web.ts` is the browser's version.)
 */
export async function fetchPack(code: string): Promise<TranslationPack> {
  const dir = new Directory(Paths.document, 'bible', 'v1');
  const target = new File(dir, `_download-${code.replace(/[^A-Za-z0-9-]/g, '_')}.json`);
  try {
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    await File.downloadFileAsync(
      `${API_URL}/bible/pack/?translation=${encodeURIComponent(code)}`,
      target,
      // A file left by an attempt that was cut off is replaced, not tripped over.
      { idempotent: true },
    );
    const pack: unknown = JSON.parse(await target.text());
    if (!isPack(pack)) throw new Error('not a pack');
    return pack;
  } finally {
    try {
      if (target.exists) target.delete();
    } catch {
      // Left behind; the next attempt overwrites it.
    }
  }
}
