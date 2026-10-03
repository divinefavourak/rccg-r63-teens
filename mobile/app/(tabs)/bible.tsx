import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, FlatList, Pressable, Share, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Animated, { useAnimatedScrollHandler, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  fetchVerseShare,
  useBookmarks,
  useBooks,
  useRecordChapterRead,
  useReference,
  useScripture,
  useToggleBookmark,
  useTranslations,
} from '../../src/api/queries';
import type { BibleBook, BibleVerse } from '../../src/api/types';
import { BibleNavigator, isOldTestament } from '../../src/components/BibleNavigator';
import { Icon, type IconName } from '../../src/components/Icon';
import { useNavClearance } from '../../src/components/useNavClearance';
import { useAuth } from '../../src/state/auth';
import { useChrome } from '../../src/state/chrome';
import { plainVerse, redLetterParts } from '../../src/data/scripture';
import { READER_THEMES, TEXT_SIZES, useReader } from '../../src/state/reader';
import { Object3D } from '../../src/ui/art';
import { POP_BG } from '../../src/ui/cards';
import { ChipRow, OptionRow } from '../../src/ui/inputs';
import { Press } from '../../src/ui/Press';
import { EmptyState, HEADER_GAP, OfflineBar, Sheet, Skeleton } from '../../src/ui/screen';
import { DURATION, POP, type PopColour, type ReaderTokens } from '../../src/theme/tokens';

/** A chapter counts as read once it has been open this long. */
const READ_AFTER_MS = 10_000;

/**
 * The Bible reader.
 *
 * Free to read with no account. The reader keeps its own light, sepia or dark
 * theme, so the reading surface is coloured from `reader.tokens` rather than
 * from the app's classes; the sheets over it are app chrome and use the app's.
 *
 * A passage is found by address (`/bible/lookup/?book=John&chapter=3`): the
 * reader knows "John 3", not a chapter id, and so does every link into it.
 * Other screens open a passage with `book` + `chapter` (+ `verse`), or with
 * `passage` when all they hold is the words of a reference.
 */
export default function BibleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const navClearance = useNavClearance(24);
  const { navHidden } = useChrome();
  const { isGuest } = useAuth();
  const reader = useReader();
  const tok = reader.tokens;

  const { book, chapter } = reader;
  // Undefined means "the server's default translation".
  const [translation, setTranslation] = useState<string | undefined>(undefined);
  /** The verse a link or a search asked for: scrolled to and marked. */
  const [focus, setFocus] = useState<number | null>(null);
  const [selected, setSelected] = useState<BibleVerse | null>(null);
  const [navigator, setNavigator] = useState<'closed' | 'books' | 'search'>('closed');
  const [sheet, setSheet] = useState<'translation' | 'text' | null>(null);

  const passage = useScripture(book, chapter, translation);
  const books = useBooks();
  const translations = useTranslations();
  const bookmarks = useBookmarks(!isGuest);

  const verses = passage.data?.verses ?? [];
  const bookName = passage.data?.book_name ?? book;
  const translationCode = passage.data?.translation?.code ?? translation ?? '';

  const open = useCallback(
    (nextBook: string, nextChapter: number, verse?: number) => {
      reader.setPosition(nextBook, nextChapter);
      setFocus(verse ?? null);
      setSelected(null);
      setNavigator('closed');
    },
    [reader],
  );

  // ── Links in from other screens ─────────────────────────────────────────
  const params = useLocalSearchParams<{
    book?: string;
    chapter?: string;
    verse?: string;
    passage?: string;
  }>();
  const referred = useReference(params.passage);
  /** The link last acted on, so re-rendering does not drag the reader back to it. */
  const applied = useRef('');

  useEffect(() => {
    const address = params.book && params.chapter ? `${params.book}|${params.chapter}|${params.verse}` : '';
    if (address && address !== applied.current) {
      applied.current = address;
      open(params.book as string, Number(params.chapter) || 1, Number(params.verse) || undefined);
      return;
    }
    const found = referred.data;
    if (params.passage && found && `p:${params.passage}` !== applied.current) {
      applied.current = `p:${params.passage}`;
      open(found.book, found.chapter, found.start_verse ?? undefined);
    }
  }, [params.book, params.chapter, params.verse, params.passage, referred.data, open]);

  // ── Previous and next, across books ─────────────────────────────────────
  const { previous, next, current } = useMemo(
    () => neighbours(books.data ?? [], book, chapter),
    [books.data, book, chapter],
  );

  // ── Reading history ─────────────────────────────────────────────────────
  const record = useRecordChapterRead();
  const recorded = useRef(new Set<string>());
  const chapterId = verses[0]?.chapter;

  const recordRead = record.mutate;
  useFocusEffect(
    useCallback(() => {
      if (isGuest || !chapterId || recorded.current.has(chapterId)) return;
      // Flicking past a chapter is not reading it. Tied to focus because a
      // tab left behind stays mounted, and its timers keep running.
      const timer = setTimeout(() => {
        recorded.current.add(chapterId);
        recordRead(chapterId);
      }, READ_AFTER_MS);
      return () => clearTimeout(timer);
    }, [chapterId, isGuest, recordRead]),
  );

  // ── The nav tucks away while reading ────────────────────────────────────
  const lastY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(
    {
      onScroll: (e) => {
        const y = e.contentOffset.y;
        const dy = y - lastY.value;
        // An 8px dead zone stops the nav flickering on small jitters.
        if (dy > 8 && y > 40) {
          navHidden.value = withTiming(1, { duration: DURATION.slow });
          lastY.value = y;
        } else if (dy < -8) {
          navHidden.value = withTiming(0, { duration: DURATION.slow });
          lastY.value = y;
        }
      },
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      // Hardware back closes the book picker before it leaves the tab.
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (navigator === 'closed') return false;
        setNavigator('closed');
        return true;
      });
      return () => {
        sub.remove();
        // Leaving the reader must always bring the nav back.
        navHidden.value = withTiming(0, { duration: DURATION.base });
      };
    }, [navigator, navHidden]),
  );

  // ── Jump to the verse a link asked for ──────────────────────────────────
  const list = useRef<FlatList<BibleVerse>>(null);
  useEffect(() => {
    list.current?.scrollToOffset({ offset: 0, animated: false });
    navHidden.value = withTiming(0, { duration: DURATION.base });
    if (!focus || verses.length === 0) return;
    const index = verses.findIndex((v) => v.number === focus);
    if (index > 0) {
      // After layout, or the list has no row heights to scroll by.
      const timer = setTimeout(
        () => list.current?.scrollToIndex({ index, animated: true, viewOffset: 16 }),
        250,
      );
      return () => clearTimeout(timer);
    }
    // Keyed on the chapter, not on `verses`: that is a new array every render.
  }, [chapterId, focus]);

  // ── Verse actions ───────────────────────────────────────────────────────
  const toggleBookmark = useToggleBookmark();
  const savedAs = useMemo(() => {
    const map = new Map<string, string>();
    for (const mark of bookmarks.data ?? []) if (mark.verse) map.set(mark.verse, mark.id);
    return map;
  }, [bookmarks.data]);

  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [selected]);

  /** The words to send, with the attribution the translation's licence needs. */
  const wordsFor = useCallback(
    async (verse: BibleVerse, kind: 'share_text' | 'copy_text') => {
      try {
        return plainVerse((await fetchVerseShare(book, chapter, verse.number, translation))[kind]);
      } catch {
        // Offline: the verse on screen and its address are still true.
        return `“${plainVerse(verse.text)}”\n${verse.reference}${translationCode ? ` (${translationCode})` : ''}`;
      }
    },
    [book, chapter, translation, translationCode],
  );

  const onShare = useCallback(async () => {
    if (!selected) return;
    const message = await wordsFor(selected, 'share_text');
    Share.share({ message }).catch(() => {});
  }, [selected, wordsFor]);

  const onCopy = useCallback(async () => {
    if (!selected) return;
    await Clipboard.setStringAsync(await wordsFor(selected, 'copy_text'));
    setCopied(true);
  }, [selected, wordsFor]);

  const onSave = useCallback(() => {
    if (!selected) return;
    if (isGuest) {
      // Keeping a verse needs somewhere to keep it.
      setSelected(null);
      router.push('/sign-up');
      return;
    }
    toggleBookmark.mutate({ verseId: selected.id, bookmarkId: savedAs.get(selected.id) });
  }, [selected, isGuest, router, toggleBookmark, savedAs]);

  // ── Rows ────────────────────────────────────────────────────────────────
  const renderVerse = useCallback(
    ({ item }: { item: BibleVerse }) => (
      <VerseRow
        verse={item}
        state={
          selected?.id === item.id ? 'selected' : focus === item.number ? 'focus' : 'plain'
        }
        saved={savedAs.has(item.id)}
        fontSize={reader.fontSize}
        tok={tok}
        onPress={setSelected}
      />
    ),
    [selected, focus, savedAs, reader.fontSize, tok],
  );

  const header = (
    <View className="gap-4">
      {isGuest && (
        <View
          className="flex-row items-center gap-2 rounded-full py-2.5 pl-3 pr-3.5"
          style={{ backgroundColor: tok.sunken }}
        >
          <Icon name="book" size={18} color={tok.text2} />
          <Text className="flex-1 font-ui-sb text-[12px] leading-4" style={{ color: tok.text2 }}>
            The Bible is always free to read. No account needed.
          </Text>
        </View>
      )}
      <ChapterHero
        eyebrow={current ? `${isOldTestament(current) ? 'Old' : 'New'} Testament · ${bookName}` : bookName}
        chapter={chapter}
        verses={verses}
      />
    </View>
  );

  const footer = (
    <View className="flex-row gap-3">
      {previous ? (
        <ChapterPill place={previous} direction="previous" tok={tok} onPress={open} />
      ) : (
        <View className="flex-1" />
      )}
      {next ? (
        <ChapterPill place={next} direction="next" tok={tok} onPress={open} />
      ) : (
        <View className="flex-1" />
      )}
    </View>
  );

  if (navigator !== 'closed') {
    return (
      <BibleNavigator
        books={books.data ?? []}
        loading={books.isPending}
        currentBook={book}
        currentChapter={chapter}
        translation={translation}
        startInSearch={navigator === 'search'}
        onPick={open}
        onClose={() => setNavigator('closed')}
      />
    );
  }

  const offline = passage.isError && !!passage.data;
  const contentStyle = {
    gap: 16,
    paddingHorizontal: 20,
    // Room for the notebook that breaks out of the top of the chapter card.
    paddingTop: 24,
    paddingBottom: navClearance,
  };

  return (
    <View className="flex-1" style={{ backgroundColor: tok.bg }}>
      {/* ── Reader bar ──────────────────────────────────────────────────── */}
      <View
        className="flex-row items-center gap-2 px-5 pb-2"
        style={{ paddingTop: insets.top + HEADER_GAP }}
      >
        <Press
          onPress={() => setNavigator('books')}
          accessibilityLabel={`Choose a book. Now reading ${bookName} ${chapter}`}
          className="h-11 shrink flex-row items-center gap-1 rounded-full pl-[18px] pr-3"
          style={{ backgroundColor: tok.ink }}
        >
          <Text
            numberOfLines={1}
            className="shrink font-ui-sb text-[16px] leading-6"
            style={{ color: tok.onInk }}
          >
            {bookName} {chapter}
          </Text>
          <Icon name="chevronDown" size={20} color={tok.onInk} />
        </Press>

        {!!translationCode && (
          <Press
            onPress={() => setSheet('translation')}
            accessibilityLabel={`Translation: ${translationCode}. Change`}
            className="h-11 items-center justify-center rounded-full px-4"
            style={{ backgroundColor: tok.sunken }}
          >
            <Text className="font-ui-sb text-[14px] leading-5" style={{ color: tok.text1 }}>
              {translationCode}
            </Text>
          </Press>
        )}

        <View className="flex-1" />

        <BarButton icon="text" label="Text size and theme" tok={tok} onPress={() => setSheet('text')} />
        <BarButton icon="search" label="Search the Bible" tok={tok} onPress={() => setNavigator('search')} />
      </View>

      {offline && <OfflineBar />}

      {/* ── The text ────────────────────────────────────────────────────── */}
      {!reader.ready || passage.isPending ? (
        <View style={contentStyle}>
          <Skeleton height={124} radius={28} />
          {[320, 320, 280, 320, 240, 320, 320, 200, 320, 260].map((w, i) => (
            <Skeleton key={i} width={`${(w / 320) * 100}%`} height={16} radius={8} />
          ))}
        </View>
      ) : passage.isError && !passage.data ? (
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="sitting"
            message="We couldn’t load this chapter. Check your connection, then try again."
            actionLabel="Try again"
            onAction={() => passage.refetch()}
          />
        </View>
      ) : verses.length === 0 ? (
        // A real address whose text has not been added yet: not an error.
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="reading"
            message={`${bookName} ${chapter} is not here in ${translationCode || 'this translation'} yet. Try another translation or chapter.`}
            actionLabel="Choose a book"
            onAction={() => setNavigator('books')}
          />
        </View>
      ) : (
        /* Virtualised: Psalm 119 is 176 verses, and this has to stay smooth on
           cheap Android phones. Row heights follow the text size, so nothing
           here assumes a fixed one. */
        <Animated.FlatList
          ref={list as never}
          data={verses}
          keyExtractor={keyOfVerse}
          renderItem={renderVerse}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={contentStyle}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
          onScrollToIndexFailed={({ index, averageItemLength }) =>
            // The row is not measured yet; get near it, which measures it.
            list.current?.scrollToOffset({ offset: index * averageItemLength, animated: true })
          }
        />
      )}

      {/* ── Verse actions ───────────────────────────────────────────────── */}
      <Sheet visible={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <View className="w-full gap-4 pt-2">
            <Text
              accessibilityRole="header"
              className="font-ui-xb text-[24px] leading-8 tracking-[-0.36px] text-ink-1"
            >
              {selected.reference}
            </Text>
            <Text numberOfLines={2} className="font-ui text-[16px] leading-6 text-ink-2">
              “{plainVerse(selected.text)}”
            </Text>
            <View className="flex-row gap-3">
              <ActionTile colour="violet" icon="shareUp" label="Share" onPress={onShare} />
              <ActionTile
                colour="amber"
                icon="bookmark"
                filled={savedAs.has(selected.id)}
                label={savedAs.has(selected.id) ? 'Saved' : 'Save'}
                onPress={onSave}
              />
              <ActionTile
                colour="sky"
                icon={copied ? 'check' : 'copy'}
                label={copied ? 'Copied' : 'Copy'}
                onPress={onCopy}
              />
            </View>
            {toggleBookmark.isError && (
              <Text
                accessibilityLiveRegion="polite"
                className="font-ui-md text-[14px] leading-5 text-feedback-error"
              >
                That did not save. Check your connection and tap again.
              </Text>
            )}
            <View className="h-[52px] flex-row items-center rounded-full bg-surf-sunken px-5">
              <Text className="flex-1 font-ui-sb text-[16px] leading-6 text-ink-3">Highlight</Text>
              <Text className="font-ui-md text-[12px] leading-4 text-ink-3">Coming soon</Text>
            </View>
          </View>
        )}
      </Sheet>

      {/* ── Translation ─────────────────────────────────────────────────── */}
      <Sheet visible={sheet === 'translation'} onClose={() => setSheet(null)}>
        <View className="w-full gap-3 pt-2">
          <SheetTitle>Translation</SheetTitle>
          {(translations.data ?? []).map((t) => (
            <OptionRow
              key={t.id}
              title={t.code}
              detail={t.name}
              selected={t.code === translationCode}
              onPress={() => {
                setTranslation(t.code);
                setSheet(null);
              }}
            />
          ))}
          {translations.isPending && <Skeleton height={60} radius={20} />}
          {translations.isError && (
            <Text className="font-ui text-[14px] leading-5 text-ink-2">
              We couldn’t load the list of translations. Close this and try again.
            </Text>
          )}
        </View>
      </Sheet>

      {/* ── Text size and theme ─────────────────────────────────────────── */}
      <Sheet visible={sheet === 'text'} onClose={() => setSheet(null)}>
        <View className="w-full gap-3 pt-2">
          <SheetTitle>Text size</SheetTitle>
          <ChipRow
            wrap
            options={TEXT_SIZES.map((size) => ({ value: String(size.value), label: size.label }))}
            value={String(reader.fontSize)}
            onChange={(value) => reader.setFontSize(Number(value))}
          />
          <View className="h-1" />
          <SheetTitle>Theme</SheetTitle>
          <ChipRow wrap options={READER_THEMES} value={reader.theme} onChange={reader.setTheme} />
        </View>
      </Sheet>
    </View>
  );
}

const keyOfVerse = (v: BibleVerse) => v.id;

// ─── Pieces ────────────────────────────────────────────────────────────────

function SheetTitle({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      className="font-ui-b text-[20px] leading-7 tracking-[-0.2px] text-ink-1"
    >
      {children}
    </Text>
  );
}

/** A round button in the reader bar, coloured by the reader's theme. */
function BarButton({
  icon,
  label,
  tok,
  onPress,
}: {
  icon: IconName;
  label: string;
  tok: ReaderTokens;
  onPress: () => void;
}) {
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={label}
      className="h-11 w-11 items-center justify-center rounded-full"
      style={{ backgroundColor: tok.sunken }}
    >
      <Icon name={icon} size={20} color={tok.text1} />
    </Press>
  );
}

/**
 * The card that opens a chapter. A colour block, so it looks the same in
 * every reader theme.
 */
const ChapterHero = memo(function ChapterHero({
  eyebrow,
  chapter,
  verses,
}: {
  eyebrow: string;
  chapter: number;
  verses: BibleVerse[];
}) {
  // A teen's reading pace, never less than a minute.
  const words = verses.reduce((sum, v) => sum + v.text.split(/\s+/).length, 0);
  const minutes = Math.max(1, Math.round(words / 200));
  return (
    <View className="w-full gap-1 rounded-3xl bg-pop-lime p-5">
      <Text
        numberOfLines={1}
        className="pr-24 font-ui-md text-[12px] uppercase leading-4 tracking-[0.96px] text-pop-on"
      >
        {eyebrow}
      </Text>
      <Text
        accessibilityRole="header"
        className="font-ui-xb text-[40px] leading-[48px] tracking-[-1.2px] text-pop-on"
      >
        Chapter {chapter}
      </Text>
      <Text className="font-ui-sb text-[14px] leading-5 text-pop-on">
        {verses.length} {verses.length === 1 ? 'verse' : 'verses'} · about {minutes}{' '}
        {minutes === 1 ? 'minute' : 'minutes'}
      </Text>
      <View pointerEvents="none" style={{ position: 'absolute', right: -6, top: -22 }}>
        <Object3D name="notebook" size={104} />
      </View>
    </View>
  );
});

/**
 * One verse. Memoised so that choosing a verse re-renders the two rows whose
 * state changed, not the whole chapter.
 */
const VerseRow = memo(function VerseRow({
  verse,
  state,
  saved,
  fontSize,
  tok,
  onPress,
}: {
  verse: BibleVerse;
  /** `selected` has its action sheet open; `focus` is where a link landed. */
  state: 'plain' | 'selected' | 'focus';
  saved: boolean;
  fontSize: number;
  tok: ReaderTokens;
  onPress: (verse: BibleVerse) => void;
}) {
  const lineHeight = Math.round(fontSize * (30 / 18));
  const selected = state === 'selected';
  return (
    <Pressable
      onPress={() => onPress(verse)}
      accessibilityRole="button"
      // The address first, then the words (09-design-principles.md).
      accessibilityLabel={`${verse.reference}${saved ? ', saved' : ''}. ${plainVerse(verse.text)}`}
      accessibilityHint="Opens share, save and copy"
      accessibilityState={{ selected }}
      style={
        selected
          ? { backgroundColor: POP.amber, borderRadius: 20, padding: 12 }
          : state === 'focus'
            ? { backgroundColor: tok.highlight, borderRadius: 12 }
            : undefined
      }
    >
      <Text
        style={{
          fontFamily: 'Lora_400Regular',
          fontSize,
          lineHeight,
          color: selected ? POP.on : tok.text1,
        }}
      >
        <Text
          style={{
            fontFamily: 'Inter_500Medium',
            fontSize: Math.round(fontSize * (12 / 18)),
            lineHeight,
            color: selected ? POP.on : tok.text3,
          }}
        >
          {verse.number}
          {'  '}
        </Text>
        {/* The words of Jesus in red. On the amber of a chosen verse the red
            is darkened so it still reads. */}
        {redLetterParts(verse.text).map((part, i) =>
          part.red ? (
            <Text key={i} style={{ color: selected ? '#8F1D14' : tok.christ }}>
              {part.text}
            </Text>
          ) : (
            part.text
          ),
        )}
      </Text>
    </Pressable>
  );
});

/** Share, Save, Copy: a colour tile with a dark round icon. */
function ActionTile({
  colour,
  icon,
  label,
  filled,
  onPress,
}: {
  colour: PopColour;
  icon: IconName;
  label: string;
  filled?: boolean;
  onPress: () => void;
}) {
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={label}
      className={`flex-1 gap-3 rounded-2xl p-4 ${POP_BG[colour]}`}
    >
      {/* Always dark with a light icon: the tile's colour does not change with the theme. */}
      <View className="h-10 w-10 items-center justify-center rounded-full bg-pop-on">
        <Icon name={icon} size={20} color="#FDFAF5" filled={filled} />
      </View>
      <Text className="font-ui-sb text-[16px] leading-6 text-pop-on">{label}</Text>
    </Press>
  );
}

interface Place {
  book: string;
  chapter: number;
  label: string;
}

function ChapterPill({
  place,
  direction,
  tok,
  onPress,
}: {
  place: Place;
  direction: 'previous' | 'next';
  tok: ReaderTokens;
  onPress: (book: string, chapter: number) => void;
}) {
  const forward = direction === 'next';
  const colour = forward ? tok.onInk : tok.text1;
  return (
    <Press
      onPress={() => onPress(place.book, place.chapter)}
      accessibilityLabel={`${forward ? 'Next' : 'Previous'} chapter, ${place.label}`}
      className={`h-[52px] flex-1 flex-row items-center justify-center gap-1 rounded-full ${
        forward ? 'pl-4 pr-3' : 'pl-3 pr-4'
      }`}
      style={{ backgroundColor: forward ? tok.ink : tok.sunken }}
    >
      {!forward && <Icon name="chevronLeft" size={20} color={colour} />}
      <Text numberOfLines={1} className="shrink font-ui-sb text-[14px] leading-5" style={{ color: colour }}>
        {place.label}
      </Text>
      {forward && <Icon name="chevronRight" size={20} color={colour} />}
    </Press>
  );
}

/**
 * The chapters either side of this one, stepping into the neighbouring book
 * at each end. Null at Genesis 1 and at the last chapter of Revelation, and
 * until the list of books has loaded.
 */
function neighbours(
  books: BibleBook[],
  book: string,
  chapter: number,
): { previous: Place | null; next: Place | null; current: BibleBook | null } {
  const index = books.findIndex((b) => b.osis_code === book);
  if (index < 0) return { previous: null, next: null, current: null };

  const here = books[index];
  const at = (b: BibleBook, n: number): Place => ({
    book: b.osis_code,
    chapter: n,
    label: `${b.name} ${n}`,
  });

  const before = books[index - 1];
  const after = books[index + 1];
  return {
    current: here,
    previous: chapter > 1 ? at(here, chapter - 1) : before ? at(before, before.chapter_count) : null,
    next: chapter < here.chapter_count ? at(here, chapter + 1) : after ? at(after, 1) : null,
  };
}
