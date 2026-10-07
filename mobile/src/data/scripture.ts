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

/** Where a shared verse points back to. The website opens the reader there. */
const SITE = 'https://www.thefaithtribe.live';

interface Quoted {
  /** The verse as stored, marks and all. */
  text: string;
  /** "John 3:16", as the server rendered it. */
  reference: string;
  /** "WEB". */
  code: string;
}

/** `"For God so loved…" — John 3:16 (WEB)`: the Copy action. */
export function copyWords({ text, reference, code }: Quoted): string {
  const quote = `"${plainVerse(text).trim()}" — ${reference}`;
  return code ? `${quote} (${code})` : quote;
}

/**
 * The Share action: the quote, where it came from, and a link back.
 *
 * Composed here, from the chapter already on the phone, in the same shape the
 * server's `bible/sharing.py` produces. It used to be a request per share,
 * which made sharing a verse fail with no signal and cost data for words the
 * phone was already showing.
 *
 * What the server was guarding is still guarded. A licensed translation's
 * copyright line travels with every chapter (`attribution_required`,
 * `copyright_notice`) and is appended here exactly as it was there. The other
 * licence rule, a cap on how many verses may be quoted together, cannot be
 * broken from this screen: it shares one verse at a time.
 */
export function shareWords(
  quoted: Quoted & { book: string; chapter: number; verse: number },
  licence?: { attribution_required?: boolean; copyright_notice?: string | null } | null,
): string {
  const link = `${SITE}/bible/${quoted.book}/${quoted.chapter}?verse=${quoted.verse}`;
  let words = `${copyWords(quoted)}, via Faith Tribe\n${link}`;
  if (licence?.attribution_required && licence.copyright_notice) {
    words += `\n\n${licence.copyright_notice}`;
  }
  return words;
}
