import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';

import { Icon } from './Icon';
import { Grabber } from './ui';
import type { BibleBook } from '../api/types';
import type { ReaderTokens } from '../theme/tokens';

/**
 * Book, then chapter — a bottom sheet, not a dropdown.
 *
 * 10-design-system.md makes sheets the mobile picker. Two steps rather than
 * one because dropping a teen into chapter 1 and making them tap "next" 118
 * times to reach Psalm 119 is not navigation. `chapter_count` from the books
 * endpoint gives the exact grid to offer instead.
 *
 * Lives outside the reader screen because it is the only piece of that file
 * with its own multi-step state, and the reader is long enough already.
 */
export function PassagePicker({
  visible,
  tok,
  currentOsis,
  currentChapter,
  books,
  loading,
  onPick,
  onClose,
}: {
  visible: boolean;
  tok: ReaderTokens;
  /** OSIS code of the open book, e.g. 'John'. */
  currentOsis: string;
  currentChapter: number;
  books: BibleBook[];
  loading: boolean;
  /** Hands back an OSIS code — the only book identifier /bible/lookup/ accepts. */
  onPick: (osisCode: string, chapter: number) => void;
  onClose: () => void;
}) {
  /** Which book's chapters are on screen. Null means the book list. */
  const [pending, setPending] = useState<BibleBook | null>(null);

  // Reopening should always start at the book list rather than wherever the
  // last visit happened to leave off.
  useEffect(() => {
    if (visible) setPending(null);
  }, [visible]);

  const isOld = (b: BibleBook) => (b.testament ?? '').toLowerCase().startsWith('old');
  const oldTestament = books.filter(isOld);
  const newTestament = books.filter((b) => !isOld(b));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close picker"
        style={{ flex: 1, backgroundColor: 'rgba(28,25,22,0.48)', justifyContent: 'flex-end' }}
      >
        <Animated.View
          entering={SlideInDown.duration(300)}
          // Stop taps inside the sheet from reaching the dismiss scrim.
          onStartShouldSetResponder={() => true}
          style={{
            maxHeight: '80%',
            backgroundColor: tok.raised,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingBottom: 32,
          }}
        >
          <Grabber />

          <View className="flex-row items-center gap-2 px-5 pb-3">
            {pending && (
              <Pressable
                onPress={() => setPending(null)}
                accessibilityRole="button"
                accessibilityLabel="Back to books"
                hitSlop={8}
                className="h-8 w-8 items-center justify-center rounded-sm"
                style={{ borderWidth: 1, borderColor: tok.border }}
              >
                <Icon name="chevronLeft" size={16} color={tok.text2} />
              </Pressable>
            )}
            <Text className="flex-1 font-ui-b text-[17px]" style={{ color: tok.text1 }}>
              {pending ? pending.name : 'Choose a book'}
            </Text>
          </View>

          {loading && (
            <Text className="px-5 py-4 font-ui text-[14px]" style={{ color: tok.text3 }}>
              Loading books…
            </Text>
          )}

          <ScrollView showsVerticalScrollIndicator={false}>
            {pending ? (
              <View className="flex-row flex-wrap gap-2 px-5 pt-1">
                {Array.from({ length: pending.chapter_count }, (_, i) => i + 1).map((n) => {
                  const active = pending.osis_code === currentOsis && n === currentChapter;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => onPick(pending.osis_code, n)}
                      accessibilityRole="button"
                      accessibilityLabel={`${pending.name} chapter ${n}`}
                      accessibilityState={{ selected: active }}
                      // 44px targets — cheap Android digitizers are imprecise
                      // (09-design-principles.md).
                      className="h-11 w-11 items-center justify-center rounded-sm"
                      style={{
                        backgroundColor: active ? tok.accent : tok.bg,
                        borderWidth: 1,
                        borderColor: active ? tok.accent : tok.border,
                      }}
                    >
                      <Text
                        className="font-ui-sb text-[15px]"
                        style={{ color: active ? '#fff' : tok.text1 }}
                      >
                        {n}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <>
                <TestamentSection
                  label="Old Testament"
                  books={oldTestament}
                  tok={tok}
                  current={currentOsis}
                  onPick={setPending}
                />
                <TestamentSection
                  label="New Testament"
                  books={newTestament}
                  tok={tok}
                  current={currentOsis}
                  onPick={setPending}
                />
              </>
            )}
          </ScrollView>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function TestamentSection({
  label,
  books,
  tok,
  current,
  onPick,
}: {
  label: string;
  books: BibleBook[];
  tok: ReaderTokens;
  /** OSIS code of the open book. */
  current: string;
  onPick: (book: BibleBook) => void;
}) {
  if (books.length === 0) return null;

  return (
    <View>
      <Text
        className="px-5 pb-1 pt-3 font-ui-b text-[11px] uppercase tracking-[1px]"
        style={{ color: tok.text3 }}
      >
        {label}
      </Text>
      {books.map((b) => (
        <Pressable
          key={b.osis_code}
          onPress={() => onPick(b)}
          accessibilityRole="button"
          accessibilityLabel={`${b.name}, ${b.chapter_count} chapters`}
          accessibilityState={{ selected: b.osis_code === current }}
          className="flex-row items-center justify-between px-5 py-3.5"
          style={{
            backgroundColor: b.osis_code === current ? tok.highlight : 'transparent',
            borderBottomWidth: 1,
            borderBottomColor: tok.border,
          }}
        >
          <Text
            className={b.osis_code === current ? 'font-ui-sb text-[15px]' : 'font-ui text-[15px]'}
            style={{ color: b.osis_code === current ? tok.accent : tok.text1 }}
          >
            {b.name}
          </Text>
          <Text className="font-ui text-[12px]" style={{ color: tok.text3 }}>
            {b.chapter_count}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
