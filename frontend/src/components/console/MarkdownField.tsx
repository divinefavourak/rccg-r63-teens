/**
 * A text box for the small Markdown event descriptions are written in
 * (`lib/markdown.ts`), with buttons for the marks and the result drawn
 * underneath as it is typed. The preview uses the same parser as the app, so
 * it is what a teen will see.
 *
 * The buttons edit through `execCommand('insertText')` where the browser
 * allows, so Ctrl+Z undoes a button press like any typing. Setting the value
 * from React would wipe the box's undo history.
 */
import { useRef, useState, type KeyboardEvent } from 'react';
import {
  Bold,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  type LucideIcon,
} from 'lucide-react';
import { Markdown } from '../Markdown';

type LineKind = 'heading' | 'bullet' | 'numbered' | 'quote';

const LINE_MARK: Record<LineKind, RegExp> = {
  heading: /^#{1,6}\s+/,
  bullet: /^[-*+]\s+/,
  numbered: /^\d{1,9}[.)]\s+/,
  quote: /^>\s?/,
};
const ANY_LINE_MARK = /^(#{1,6}\s+|[-*+]\s+|\d{1,9}[.)]\s+|>\s?)/;

const lineMark = (kind: LineKind, n: number) =>
  ({ heading: '## ', bullet: '- ', numbered: `${n + 1}. `, quote: '> ' })[kind];

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl+';

/**
 * Not for inside a <label>: a click anywhere in a label, the preview
 * included, is passed to the first control in it, which here is Bold. Name
 * the box with `<label htmlFor={id}>` instead.
 */
export const MarkdownField = ({
  id,
  value,
  onChange,
  rows = 6,
  placeholder,
  className = '',
}: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
  /** The box's own look, so it matches the inputs around it. */
  className?: string;
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(true);

  /** Puts `text` over [start, end), then selects [selStart, selEnd). */
  const replace = (start: number, end: number, text: string, selStart: number, selEnd: number) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(start, end);
    let done = false;
    try {
      done = document.execCommand('insertText', false, text);
    } catch {
      done = false;
    }
    if (!done) onChange(el.value.slice(0, start) + text + el.value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  };

  /** Bold, italic, struck: around the selection, or around a word to type over. */
  const wrap = (mark: string, placeholderWord: string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = el.value.slice(s, e);
    // Already wrapped: take the marks off instead.
    if (
      selected &&
      el.value.slice(s - mark.length, s) === mark &&
      el.value.slice(e, e + mark.length) === mark
    ) {
      replace(s - mark.length, e + mark.length, selected, s - mark.length, e - mark.length);
      return;
    }
    // Spaces just inside the marks would stop them counting; keep them outside.
    const lead = selected.match(/^\s*/)![0];
    const trail = selected.match(/\s*$/)![0];
    const word = selected.trim() || placeholderWord;
    const text = `${lead}${mark}${word}${mark}${trail}`;
    const at = s + lead.length + mark.length;
    replace(s, e, text, at, at + word.length);
  };

  /** Headings, lists and quotes: every line the selection touches. */
  const toggleLines = (kind: LineKind) => {
    const el = ref.current;
    if (!el) return;
    const { value: v, selectionStart: s, selectionEnd: e } = el;
    const start = v.lastIndexOf('\n', s - 1) + 1;
    const nextBreak = v.indexOf('\n', e > s && v[e - 1] === '\n' ? e - 1 : e);
    const end = nextBreak === -1 ? v.length : nextBreak;
    const lines = v.slice(start, end).split('\n');
    const already = lines.every((line) => !line.trim() || LINE_MARK[kind].test(line));
    let n = 0;
    const next = lines
      .map((line) => {
        if (!line.trim()) return line;
        if (already) return line.replace(LINE_MARK[kind], '');
        // Swap any other mark rather than stacking two ("## - item").
        return lineMark(kind, n++) + line.replace(ANY_LINE_MARK, '');
      })
      .join('\n');
    replace(start, end, next, start, start + next.length);
  };

  const link = () => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = el.value.slice(s, e).trim();
    // A pasted address selected: it is the link, and the words come first.
    if (/^https?:\/\/\S+$/.test(selected)) {
      const text = `[link text](${selected})`;
      replace(s, e, text, s + 1, s + 10);
      return;
    }
    const words = selected || 'link text';
    const text = `[${words}](https://)`;
    const urlAt = s + words.length + 3;
    replace(s, e, text, urlAt, urlAt + 'https://'.length);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'b') wrap('**', 'bold words');
    else if (key === 'i') wrap('*', 'slanted words');
    else if (key === 'k') link();
    else return;
    event.preventDefault();
  };

  const tools: { icon: LucideIcon; label: string; run: () => void }[] = [
    { icon: Bold, label: `Bold (${MOD}B)`, run: () => wrap('**', 'bold words') },
    { icon: Italic, label: `Italic (${MOD}I)`, run: () => wrap('*', 'slanted words') },
    { icon: Strikethrough, label: 'Strike through', run: () => wrap('~~', 'struck words') },
    { icon: Heading2, label: 'Heading', run: () => toggleLines('heading') },
    { icon: List, label: 'Bulleted list', run: () => toggleLines('bullet') },
    { icon: ListOrdered, label: 'Numbered list', run: () => toggleLines('numbered') },
    { icon: Quote, label: 'Quote', run: () => toggleLines('quote') },
    { icon: Link2, label: `Link (${MOD}K)`, run: link },
  ];

  return (
    <div className="mt-1">
      <div
        role="toolbar"
        aria-label="Formatting"
        className="flex flex-wrap items-center gap-0.5 rounded-t-console-md bg-console-tinted px-1.5 pt-1.5"
      >
        {tools.map(({ icon: Icon, label, run }) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            // Keeps the selection in the box while the button is pressed.
            onMouseDown={(e) => e.preventDefault()}
            onClick={run}
            className="flex h-8 w-8 items-center justify-center rounded-console-sm text-console-body transition-colors hover:bg-console-surface hover:text-console-text"
          >
            <Icon size={16} strokeWidth={2.25} aria-hidden />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          aria-pressed={showPreview}
          className="ml-auto rounded-console-sm px-2 py-1 text-[12px] font-medium text-console-action hover:underline"
        >
          {showPreview ? 'Hide preview' : 'Show preview'}
        </button>
      </div>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className={`${className} !mt-0 rounded-t-none`}
      />
      {showPreview && (
        <div className="mt-2 rounded-console-md border border-console-border p-3.5">
          <span className="block text-[12px] font-medium uppercase leading-4 tracking-[0.06em] text-console-muted">
            How it will look
          </span>
          {value.trim() ? (
            <Markdown
              source={value}
              tone="console"
              className="mt-2 text-[15px] leading-6 text-console-body"
            />
          ) : (
            <p className="mt-2 text-[14px] leading-5 text-console-subtle">
              Start typing above. **Two stars** make bold words, a line starting with “- ” makes a list.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default MarkdownField;
