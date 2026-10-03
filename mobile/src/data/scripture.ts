/**
 * Some translations mark the words of Jesus by wrapping them in \u2039 \u203a.
 * The marks are instructions to the reader, not text: the reader sets those
 * words in red, and everywhere else they are simply removed.
 */

const OPEN = '\u2039';
const CLOSE = '\u203a';

export interface VersePart {
  text: string;
  /** Spoken by Jesus. */
  red: boolean;
}

/** A verse as runs of plain and red text, with the marks themselves gone. */
export function redLetterParts(text: string): VersePart[] {
  const parts: VersePart[] = [];
  let red = false;
  let run = '';
  for (const char of text) {
    if (char === OPEN || char === CLOSE) {
      if (run) parts.push({ text: run, red });
      run = '';
      red = char === OPEN;
    } else {
      run += char;
    }
  }
  if (run) parts.push({ text: run, red });
  return parts;
}

/** The verse with the marks removed, for quoting, sharing and screen readers. */
export function plainVerse(text: string): string {
  return text.split(OPEN).join('').split(CLOSE).join('');
}
