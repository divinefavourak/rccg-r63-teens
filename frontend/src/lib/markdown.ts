/**
 * The small Markdown an event description is written in.
 *
 * KEEP IN STEP with `mobile/src/data/markdown.ts`: the app draws descriptions
 * from that copy, and the Console preview here must show an organiser exactly
 * what a teen sees there. The two files are the same apart from this comment.
 *
 * Deliberately a subset, the one the Console's toolbar writes:
 *
 *   # Heading (also ## and ###)      **bold**   *italic*   ~~struck~~
 *   - bullet / 1. numbered lists     [words](https://link)   bare https://links
 *   > quote                          ---  (a dividing line)
 *
 * Anything else stays as the characters typed. Unlike strict Markdown, a single
 * line break is kept as a line break: descriptions written before this were
 * plain text laid out with Enter, and they must still read the same.
 *
 * Parsed to a tree rather than HTML so each app draws it with its own pieces
 * (React Native has no HTML), and so there is no markup to sanitise. Links are
 * kept only for http(s), mailto and tel.
 */

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'break' }
  | { type: 'strong' | 'em' | 'strike'; children: Inline[] }
  | { type: 'link'; href: string; children: Inline[] };

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'quote'; children: Inline[] }
  | { type: 'list'; ordered: boolean; start: number; items: Inline[][] }
  | { type: 'rule' };

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const NUMBERED = /^\s{0,3}(\d{1,9})[.)]\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const CONTINUATION = /^\s{2,}\S/;

const startsBlock = (line: string) =>
  HEADING.test(line) || BULLET.test(line) || NUMBERED.test(line) || QUOTE.test(line) || RULE.test(line);

export function parseMarkdown(source: string | null | undefined): Block[] {
  const lines = (source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ type: 'rule' });
      i += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const level = Math.min(heading[1].length, 3) as 1 | 2 | 3;
      blocks.push({ type: 'heading', level, children: parseInline(heading[2]) });
      i += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        quoted.push(QUOTE.exec(lines[i])![1]);
        i += 1;
      }
      blocks.push({ type: 'quote', children: parseInline(quoted.join('\n').trim()) });
      continue;
    }

    const bullet = BULLET.test(line);
    const numbered = NUMBERED.exec(line);
    if (bullet || numbered) {
      const pattern = bullet ? BULLET : NUMBERED;
      const items: string[] = [];
      while (i < lines.length) {
        const match = pattern.exec(lines[i]);
        if (match) {
          items.push(bullet ? match[1] : match[2]);
        } else if (items.length && CONTINUATION.test(lines[i])) {
          // An indented line carries on the item above it.
          items[items.length - 1] += `\n${lines[i].trim()}`;
        } else {
          break;
        }
        i += 1;
      }
      blocks.push({
        type: 'list',
        ordered: !bullet,
        start: numbered ? Number(numbered[1]) : 1,
        items: items.map(parseInline),
      });
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'paragraph', children: parseInline(paragraph.join('\n')) });
  }

  return blocks;
}

// ─── Inline ──────────────────────────────────────────────────────────────────

const ESCAPABLE = '\\`*_{}[]()#+-.!>~|';
const LINK = /^\[([^\]\n]+)\]\(\s*(\S+?)\s*\)/;
const BARE_URL = /^https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/;
// Letters and digits, Latin with accents included. Spelled out rather than
// \p{L}, which not every JavaScript engine the app runs on accepts.
const WORD = /[A-Za-z0-9À-ɏ]/;

/** A link the apps will open, or null for anything else (javascript: and the like). */
export function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) return href;
  // A bare domain someone typed as `[site](example.com)`.
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(href)) return `https://${href}`;
  return null;
}

/**
 * Where the delimiter that closes one opened at `from` sits, or -1. A closer
 * hugs the text (no space before it), and a single `*` or `_` is not half of a
 * double one, so `*a **b** c*` closes on the last star.
 */
function findCloser(text: string, from: number, marker: string): number {
  for (let at = text.indexOf(marker, from); at !== -1; at = text.indexOf(marker, at + 1)) {
    if (at === from || /\s/.test(text[at - 1])) continue;
    if (marker.length === 1) {
      if (text[at - 1] === marker || text[at + 1] === marker) continue;
      // Underscores inside a word (snake_case) are not emphasis.
      if (marker === '_' && at + 1 < text.length && WORD.test(text[at + 1])) continue;
    }
    return at;
  }
  return -1;
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) out.push({ type: 'text', text: buffer });
    buffer = '';
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const rest = text.slice(i);

    if (ch === '\\' && i + 1 < text.length && ESCAPABLE.includes(text[i + 1])) {
      buffer += text[i + 1];
      i += 2;
      continue;
    }

    if (ch === '\n') {
      flush();
      out.push({ type: 'break' });
      i += 1;
      continue;
    }

    if (ch === '[') {
      const link = LINK.exec(rest);
      const href = link ? safeHref(link[2]) : null;
      if (link && href) {
        flush();
        out.push({ type: 'link', href, children: parseInline(link[1]) });
        i += link[0].length;
        continue;
      }
    }

    if (ch === 'h' && (i === 0 || !WORD.test(text[i - 1]))) {
      const url = BARE_URL.exec(rest);
      if (url) {
        flush();
        out.push({ type: 'link', href: url[0], children: [{ type: 'text', text: url[0] }] });
        i += url[0].length;
        continue;
      }
    }

    const double = rest.startsWith('**') || rest.startsWith('__') || rest.startsWith('~~');
    if (double && text[i + 2] && !/\s/.test(text[i + 2])) {
      const marker = rest.slice(0, 2);
      const end = findCloser(text, i + 2, marker);
      if (end !== -1) {
        flush();
        out.push({
          type: marker === '~~' ? 'strike' : 'strong',
          children: parseInline(text.slice(i + 2, end)),
        });
        i = end + 2;
        continue;
      }
    }

    if (
      (ch === '*' || ch === '_') &&
      text[i + 1] &&
      text[i + 1] !== ch &&
      !/\s/.test(text[i + 1]) &&
      // An underscore inside a word opens nothing either.
      !(ch === '_' && i > 0 && WORD.test(text[i - 1]))
    ) {
      const end = findCloser(text, i + 1, ch);
      if (end !== -1) {
        flush();
        out.push({ type: 'em', children: parseInline(text.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    buffer += ch;
    i += 1;
  }

  flush();
  return out;
}

// ─── Plain text ──────────────────────────────────────────────────────────────

function inlineText(nodes: Inline[]): string {
  return nodes
    .map((n) => (n.type === 'text' ? n.text : n.type === 'break' ? '\n' : inlineText(n.children)))
    .join('');
}

/** The words without the marks: for previews, share messages and screen readers. */
export function markdownToPlainText(source: string | null | undefined): string {
  return parseMarkdown(source)
    .map((block) => {
      switch (block.type) {
        case 'rule':
          return '';
        case 'list':
          return block.items
            .map((item, n) => `${block.ordered ? `${block.start + n}.` : '•'} ${inlineText(item)}`)
            .join('\n');
        default:
          return inlineText(block.children);
      }
    })
    .filter(Boolean)
    .join('\n\n');
}
