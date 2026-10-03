import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { useScriptureSearch } from '../api/queries';
import type { BibleBook, BibleVerse } from '../api/types';
import { plainVerse } from '../data/scripture';
import { POP_BG } from '../ui/cards';
import { ChipRow, SearchField } from '../ui/inputs';
import { Press } from '../ui/Press';
import { BackHeader, EmptyState, Skeleton } from '../ui/screen';
import type { PopColour } from '../theme/tokens';
import { useNavClearance } from './useNavClearance';

type Testament = 'old' | 'new';

const TESTAMENTS = [
  { value: 'old', label: 'Old Testament' },
  { value: 'new', label: 'New Testament' },
] as const;

/** Book tiles take these in turn, so neighbours never share a colour. */
const TILE_COLOURS: PopColour[] = ['violet', 'amber', 'sky', 'pink', 'lime'];

const GRID_GAP = 10;
const SIDE = 20;

export function isOldTestament(book: BibleBook): boolean {
  return (book.testament ?? '').toLowerCase().startsWith('o');
}

/**
 * Book, then chapter (Figma "Navigator").
 *
 * The search field does two jobs, the way the backend's search does
 * (08-bible-experience.md §4): as you type it narrows the book tiles, and on
 * the keyboard's search key it looks the words up in Scripture — an address
 * such as "jn 3:16" opens straight away, anything else lists the verses that
 * match.
 */
export function BibleNavigator({
  books,
  loading,
  currentBook,
  currentChapter,
  translation,
  startInSearch,
  onPick,
  onClose,
}: {
  books: BibleBook[];
  loading: boolean;
  /** OSIS code of the open book. */
  currentBook: string;
  currentChapter: number;
  translation?: string;
  /** Opened from the search button: the field takes focus at once. */
  startInSearch: boolean;
  onPick: (book: string, chapter: number, verse?: number) => void;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const navClearance = useNavClearance(24);
  const scroll = useRef<ScrollView>(null);

  const current = useMemo(
    () => books.find((b) => b.osis_code === currentBook) ?? null,
    [books, currentBook],
  );

  const [testament, setTestament] = useState<Testament>(
    current && isOldTestament(current) ? 'old' : 'new',
  );
  /** The book whose chapters are showing. Starts as the one being read. */
  const [chosen, setChosen] = useState<BibleBook | null>(current);
  const [text, setText] = useState('');
  /** What was last sent to Scripture search; typing alone sends nothing. */
  const [asked, setAsked] = useState('');

  // The books arrive after the first render on a cold start.
  useEffect(() => {
    if (!chosen && current) {
      setChosen(current);
      setTestament(isOldTestament(current) ? 'old' : 'new');
    }
  }, [chosen, current]);

  const search = useScriptureSearch(asked, translation);

  // An address is an answer, not a list: open it.
  useEffect(() => {
    const found = search.data;
    if (found?.kind === 'reference' && found.book && found.chapter && found.query === asked) {
      onPick(found.book, found.chapter, found.verses?.[0]?.number);
    }
  }, [search.data, asked, onPick]);

  const typed = text.trim().toLowerCase();
  const shown = useMemo(() => {
    if (typed) return books.filter((b) => b.name.toLowerCase().includes(typed));
    return books.filter((b) => (testament === 'old') === isOldTestament(b));
  }, [books, typed, testament]);

  const tile = Math.floor((width - SIDE * 2 - GRID_GAP * 2) / 3);

  const choose = useCallback((book: BibleBook) => {
    setChosen(book);
    // The chapters sit under the grid, which can be a long way down in the
    // Old Testament; bring them into view rather than leave the tap looking dead.
    requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: true }));
  }, []);

  const onChangeText = useCallback((value: string) => {
    setText(value);
    if (!value.trim()) setAsked('');
  }, []);

  const hits = asked && search.data?.kind === 'keyword' ? (search.data.results ?? []) : [];

  return (
    <View className="flex-1 bg-surf-base">
      <BackHeader title="Choose a book" onBack={onClose} />

      <ScrollView
        ref={scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          gap: 16,
          paddingHorizontal: SIDE,
          paddingTop: 8,
          paddingBottom: navClearance,
        }}
      >
        <SearchField
          label="Search books or verses"
          value={text}
          onChange={onChangeText}
          onSubmit={() => setAsked(text.trim())}
          autoFocus={startInSearch}
        />

        {!typed && <ChipRow options={TESTAMENTS} value={testament} onChange={setTestament} />}

        {loading ? (
          <View className="flex-row flex-wrap" style={{ gap: GRID_GAP }}>
            {Array.from({ length: 9 }, (_, i) => (
              <Skeleton key={i} width={tile} height={84} radius={20} />
            ))}
          </View>
        ) : (
          <View className="flex-row flex-wrap" style={{ gap: GRID_GAP }}>
            {shown.map((book, i) => (
              <BookTile
                key={book.osis_code}
                book={book}
                width={tile}
                colour={TILE_COLOURS[i % TILE_COLOURS.length]}
                chosen={chosen?.osis_code === book.osis_code}
                onPress={choose}
              />
            ))}
          </View>
        )}

        {!!typed && shown.length === 0 && !asked && (
          <Text className="font-ui text-[14px] leading-5 text-ink-2">
            No book has that name. Press search to look for those words in the Bible.
          </Text>
        )}

        {!!asked && (
          <Verses
            asked={asked}
            pending={search.isPending}
            failed={search.isError}
            hits={hits}
            onRetry={() => search.refetch()}
            onPick={onPick}
          />
        )}

        {chosen && !asked && (
          <>
            <Text accessibilityRole="header" className="font-ui-b text-[17px] leading-6 text-ink-1">
              {chosen.name} · pick a chapter
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {Array.from({ length: chosen.chapter_count }, (_, i) => i + 1).map((n) => {
                const open = chosen.osis_code === currentBook && n === currentChapter;
                return (
                  <Press
                    key={n}
                    onPress={() => onPick(chosen.osis_code, n)}
                    accessibilityLabel={`${chosen.name} chapter ${n}`}
                    accessibilityState={{ selected: open }}
                    className={`h-11 w-11 items-center justify-center rounded-full ${
                      open ? 'bg-pop-green' : 'bg-surf-sunken'
                    }`}
                  >
                    <Text
                      className={`font-ui-sb text-[14px] leading-5 ${
                        open ? 'text-pop-on' : 'text-ink-1'
                      }`}
                    >
                      {n}
                    </Text>
                  </Press>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const BookTile = memo(function BookTile({
  book,
  width,
  colour,
  chosen,
  onPress,
}: {
  book: BibleBook;
  width: number;
  colour: PopColour;
  chosen: boolean;
  onPress: (book: BibleBook) => void;
}) {
  const text = chosen ? 'text-on-ink' : 'text-pop-on';
  return (
    <Press
      onPress={() => onPress(book)}
      accessibilityLabel={`${book.name}, ${book.chapter_count} chapters`}
      accessibilityState={{ selected: chosen }}
      className={`h-[84px] justify-between rounded-xl p-3 ${chosen ? 'bg-ink' : POP_BG[colour]}`}
      style={{ width }}
    >
      <Text numberOfLines={1} className={`font-ui-sb text-[14px] leading-5 ${text}`}>
        {/* A tile holds about ten letters; longer names use the short form. */}
        {book.name.length > 10 && book.abbreviation ? book.abbreviation : book.name}
      </Text>
      <Text className={`font-ui-md text-[12px] leading-4 ${text}`}>{book.chapter_count} ch</Text>
    </Press>
  );
});

/** What Scripture search found for the words asked. */
function Verses({
  asked,
  pending,
  failed,
  hits,
  onRetry,
  onPick,
}: {
  asked: string;
  pending: boolean;
  failed: boolean;
  hits: { osis_code: string; name: string; verses: BibleVerse[] }[];
  onRetry: () => void;
  onPick: (book: string, chapter: number, verse?: number) => void;
}) {
  if (pending) {
    return (
      <View className="gap-3">
        <Skeleton width={140} height={20} radius={8} />
        <Skeleton height={72} radius={20} />
        <Skeleton height={72} radius={20} />
      </View>
    );
  }
  if (failed) {
    return (
      <EmptyState
        drawing="sitting"
        message="We couldn’t search just now. Check your connection, then try again."
        actionLabel="Try again"
        onAction={onRetry}
      />
    );
  }
  if (hits.length === 0) {
    return (
      <EmptyState
        drawing="strolling"
        message={`Nothing for “${asked}” in the Bible. Try a shorter word.`}
      />
    );
  }

  return (
    <View className="gap-3">
      <Text accessibilityRole="header" className="font-ui-b text-[17px] leading-6 text-ink-1">
        Verses with “{asked}”
      </Text>
      {hits.flatMap((group) =>
        group.verses.map((verse) => (
          <Press
            key={verse.id}
            scaleTo={0.985}
            onPress={() => onPick(group.osis_code, chapterOf(verse.reference), verse.number)}
            accessibilityLabel={`${verse.reference}. ${verse.text}`}
            className="gap-1 rounded-xl bg-surf-sunken p-4"
          >
            <Text className="font-ui-sb text-[14px] leading-5 text-ink-1">{verse.reference}</Text>
            <Text numberOfLines={3} className="font-read text-[16px] leading-6 text-ink-2">
              {plainVerse(verse.text)}
            </Text>
          </Press>
        )),
      )}
    </View>
  );
}

/** "1 John 3:16" -> 3. The reference is the server's own rendering. */
function chapterOf(reference: string): number {
  const match = /(\d+):\d+$/.exec(reference);
  return match ? Number(match[1]) : 1;
}
