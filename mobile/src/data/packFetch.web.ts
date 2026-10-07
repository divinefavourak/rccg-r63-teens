import { API_URL } from '../api/config';
import { isPack, type TranslationPack } from './bibleStore';

/**
 * `packFetch.ts` for the browser, which has no downloader to hand the work to:
 * one ordinary request, read as JSON.
 *
 * Throws when the download fails. A refusal on licence grounds has `403` in
 * the message, as it does in the app.
 */
export async function fetchPack(code: string): Promise<TranslationPack> {
  const response = await fetch(`${API_URL}/bible/pack/?translation=${encodeURIComponent(code)}`);
  if (!response.ok) throw new Error(`pack refused: ${response.status}`);
  const pack: unknown = await response.json();
  if (!isPack(pack)) throw new Error('not a pack');
  return pack;
}
