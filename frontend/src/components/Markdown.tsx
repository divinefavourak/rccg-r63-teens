/**
 * Draws the small Markdown an event description is written in
 * (`lib/markdown.ts`). The app draws the same tree with its own pieces
 * (`mobile/src/components/Markdown.tsx`), so the Console's preview is what a
 * teen will see, give or take the font.
 *
 * Built from elements, never from an HTML string: there is nothing to
 * sanitise, and a link can only be one `safeHref` allowed.
 */
import { Fragment, useMemo } from 'react';
import { parseMarkdown, type Block, type Inline } from '../lib/markdown';

type Tone = 'console' | 'site';

const RULE: Record<Tone, string> = {
  console: 'border-console-border',
  site: 'border-gray-200',
};
const QUOTE: Record<Tone, string> = {
  console: 'border-console-border-strong',
  site: 'border-emerald-300',
};

export const Markdown = ({
  source,
  tone = 'site',
  className = '',
}: {
  source: string | null | undefined;
  tone?: Tone;
  className?: string;
}) => {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  if (blocks.length === 0) return null;
  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, i) => (
        <MarkdownBlock key={i} block={block} tone={tone} />
      ))}
    </div>
  );
};

const MarkdownBlock = ({ block, tone }: { block: Block; tone: Tone }) => {
  switch (block.type) {
    case 'heading': {
      const Tag = (['h3', 'h4', 'h5'] as const)[block.level - 1];
      const size = ['text-[1.35em] font-extrabold', 'text-[1.18em] font-bold', 'text-[1.05em] font-semibold'][
        block.level - 1
      ];
      return (
        <Tag className={`${size} leading-snug tracking-[-0.01em]`}>
          <Spans nodes={block.children} />
        </Tag>
      );
    }
    case 'quote':
      return (
        <blockquote className={`border-l-4 pl-3 font-serif italic ${QUOTE[tone]}`}>
          <Spans nodes={block.children} />
        </blockquote>
      );
    case 'list': {
      const items = block.items.map((item, n) => (
        <li key={n}>
          <Spans nodes={item} />
        </li>
      ));
      return block.ordered ? (
        <ol start={block.start} className="list-decimal space-y-1 pl-6">
          {items}
        </ol>
      ) : (
        <ul className="list-disc space-y-1 pl-6">{items}</ul>
      );
    }
    case 'rule':
      return <hr className={RULE[tone]} />;
    default:
      return (
        <p>
          <Spans nodes={block.children} />
        </p>
      );
  }
};

const Spans = ({ nodes }: { nodes: Inline[] }) => (
  <>
    {nodes.map((node, i) => {
      switch (node.type) {
        case 'text':
          return <Fragment key={i}>{node.text}</Fragment>;
        case 'break':
          return <br key={i} />;
        case 'strong':
          return (
            <strong key={i} className="font-bold">
              <Spans nodes={node.children} />
            </strong>
          );
        case 'em':
          return (
            <em key={i}>
              <Spans nodes={node.children} />
            </em>
          );
        case 'strike':
          return (
            <s key={i}>
              <Spans nodes={node.children} />
            </s>
          );
        case 'link':
          return (
            <a
              key={i}
              href={node.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2"
            >
              <Spans nodes={node.children} />
            </a>
          );
      }
    })}
  </>
);

export default Markdown;
