import { Fragment, useMemo } from 'react';
import { Linking, Text, View } from 'react-native';

import { parseMarkdown, type Block, type Inline } from '../data/markdown';

/**
 * Draws the small Markdown an organiser writes an event description in
 * (`data/markdown.ts`). The Console previews the same tree with its own
 * pieces (`frontend/src/components/Markdown.tsx`), so what they saw is what
 * shows here.
 *
 * Bold is a font, not a weight: React Native picks nothing for `fontWeight` on
 * a custom font on Android, so it switches to Inter Bold. Italic has no Inter
 * file loaded; Android and the browser slant the regular face instead.
 */
export function Markdown({
  source,
  className = 'font-ui text-[16px] leading-6 text-ink-2',
}: {
  source: string | null | undefined;
  /** The body text's look. Headings, quotes and lists are drawn around it. */
  className?: string;
}) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  if (blocks.length === 0) return null;

  return (
    <View className="w-full gap-3">
      {blocks.map((block, i) => (
        <MarkdownBlock key={i} block={block} body={className} />
      ))}
    </View>
  );
}

const HEADING_CLASS = {
  1: 'font-ui-xb text-[22px] leading-7 tracking-[-0.33px] text-ink-1',
  2: 'font-ui-b text-[19px] leading-6 tracking-[-0.2px] text-ink-1',
  3: 'font-ui-sb text-[17px] leading-6 text-ink-1',
} as const;

function MarkdownBlock({ block, body }: { block: Block; body: string }) {
  switch (block.type) {
    case 'heading':
      return (
        <Text accessibilityRole="header" className={HEADING_CLASS[block.level]}>
          <Spans nodes={block.children} />
        </Text>
      );
    case 'quote':
      return (
        <View className="border-l-4 border-line-strong pl-3">
          <Text className="font-read-i text-[17px] leading-7 text-ink-2">
            <Spans nodes={block.children} />
          </Text>
        </View>
      );
    case 'list':
      return (
        <View className="gap-1.5">
          {block.items.map((item, n) => (
            <View key={n} className="flex-row">
              <Text className={`${body} w-6`}>
                {block.ordered ? `${block.start + n}.` : '•'}
              </Text>
              <Text className={`${body} flex-1`}>
                <Spans nodes={item} />
              </Text>
            </View>
          ))}
        </View>
      );
    case 'rule':
      return <View className="my-1 h-px w-full bg-line" />;
    default:
      return (
        <Text className={body}>
          <Spans nodes={block.children} />
        </Text>
      );
  }
}

/** Runs of text, nested inside the block's own <Text> so they wrap as one. */
function Spans({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, i) => {
        switch (node.type) {
          case 'text':
            return <Fragment key={i}>{node.text}</Fragment>;
          case 'break':
            return <Fragment key={i}>{'\n'}</Fragment>;
          case 'strong':
            return (
              <Text key={i} className="font-ui-b text-ink-1">
                <Spans nodes={node.children} />
              </Text>
            );
          case 'em':
            return (
              <Text key={i} style={{ fontStyle: 'italic' }}>
                <Spans nodes={node.children} />
              </Text>
            );
          case 'strike':
            return (
              <Text key={i} style={{ textDecorationLine: 'line-through' }}>
                <Spans nodes={node.children} />
              </Text>
            );
          case 'link':
            return (
              <Text
                key={i}
                accessibilityRole="link"
                onPress={() => Linking.openURL(node.href).catch(() => {})}
                className="font-ui-sb text-ink-1 underline"
              >
                <Spans nodes={node.children} />
              </Text>
            );
        }
      })}
    </>
  );
}
