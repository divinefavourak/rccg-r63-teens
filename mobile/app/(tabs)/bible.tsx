import { memo, useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  useReducedMotion,
  SlideInDown,
} from 'react-native-reanimated';

import { Icon } from '../../src/components/Icon';
import { PassagePicker } from '../../src/components/PassagePicker';
import { ErrorState, ListSkeleton } from '../../src/components/states';
import { useChrome } from '../../src/state/chrome';
import { useNavClearance } from '../../src/components/useNavClearance';
import { useBooks, useScripture, useTranslations } from '../../src/api/queries';
import type { BibleVerse } from '../../src/api/types';
import { DURATION, NAV, READER_TOKENS, type ReaderTheme, type ReaderTokens } from '../../src/theme/tokens';

/** User-scalable 14–28px, reader default 18 (09-design-principles.md). */
const FONT_MIN = 14;
const FONT_MAX = 28;
const FONT_STEP = 2;

/**
 * The Bible Reader.
 *
 * "The calmest surface in the product — when a teen is in the text, the
 * interface disappears" (09-design-principles.md). Every piece of chrome here
 * either gets out of the way on scroll or is one tap from doing so.
 *
 * The reader carries its own light/sepia/dark theme, independent of the app's,
 * so it does not read from `useTheme()`.
 *
 * Passages are resolved by address (`/bible/lookup/?book=John&chapter=3`)
 * rather than by primary key, because the reader knows "John 3" — not a chapter
 * UUID — and so does every link that opens it.
 */
export default function BibleScreen() {
  const insets = useSafeAreaInsets();
  const { navHidden } = useChrome();
  const navClearance = useNavClearance(24);
  const reduceMotion = useReducedMotion();

  const [theme, setTheme] = useState<ReaderTheme>('light');
  // An OSIS code, NOT a display name. `/bible/lookup/` resolves `book` against
  // `osis_code`, so 'Genesis' finds nothing and 'Gen' does — the one book where
  // the two happen to be identical is John, which is why a hardcoded 'John'
  // masked this for every other book.
  const [book, setBook] = useState('John');
  const [chapter, setChapter] = useState(3);
  // Undefined means "the server's default translation".
  const [translation, setTranslation] = useState<string | undefined>(undefined);
  const [fontSize, setFontSize] = useState(18);
  const [useSerif, setUseSerif] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [showBooks, setShowBooks] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);
  const [highlighted, setHighlighted] = useState<ReadonlySet<number>>(() => new Set());

  const passage = useScripture(book, chapter, translation);
  const translations = useTranslations();
  const books = useBooks();

  const verses = passage.data?.verses ?? [];
  const bookName = passage.data?.book_name ?? book;
  const translationCode = passage.data?.translation?.code ?? translation ?? '—';

  // Chapter navigation needs an upper bound or next/prev walks off the end of
  // the book and lands on a valid-but-empty address, which reads to a teen as
  // "the Bible is broken" rather than "there is no John 22".
  const chapterCount =
    (books.data ?? []).find((b) => b.osis_code === book)?.chapter_count ?? null;

  const tok = READER_TOKENS[theme];

  // ── Scroll-driven chrome ────────────────────────────────────────────────
  // Both the floating toolbar and the app's bottom nav retract on scroll-down
  // and return on scroll-up. The whole gesture lives on the UI thread; the JS
  // thread never learns about individual scroll frames.
  const lastY = useSharedValue(0);
  const toolbarHidden = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler(
    {
      onScroll: (e) => {
        const y = e.contentOffset.y;
        const dy = y - lastY.value;
        // An 8px dead zone stops the chrome flickering on small jitters.
        if (dy > 8 && y > 40) {
          toolbarHidden.value = withTiming(1, { duration: DURATION.slow });
          navHidden.value = withTiming(1, { duration: DURATION.slow });
          lastY.value = y;
        } else if (dy < -8) {
          toolbarHidden.value = withTiming(0, { duration: DURATION.slow });
          navHidden.value = withTiming(0, { duration: DURATION.slow });
          lastY.value = y;
        }
      },
    },
    [],
  );

  // Leaving the reader must always restore the nav — otherwise a teen who
  // scrolled down and switched tabs would find it missing.
  useFocusEffect(
    useCallback(() => {
      return () => {
        navHidden.value = withTiming(0, { duration: DURATION.base });
      };
    }, [navHidden]),
  );

  const toolbarStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 1 : 1 - toolbarHidden.value,
    transform: [{ translateY: toolbarHidden.value * 24 }],
  }));

  // ── Verse interaction ───────────────────────────────────────────────────
  const toggleHighlight = useCallback((n: number) => {
    setHighlighted((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }, []);

  const goToChapter = useCallback(
    (next: number) => {
      if (next < 1) return;
      if (chapterCount !== null && next > chapterCount) return;
      setChapter(next);
      setHighlighted(new Set());
    },
    [chapterCount],
  );

  const renderVerse = useCallback(
    ({ item }: { item: BibleVerse }) => (
      <VerseRow
        verse={item}
        reference={`${bookName} ${chapter}`}
        highlighted={highlighted.has(item.number)}
        fontSize={fontSize}
        useSerif={useSerif}
        tok={tok}
        onPress={toggleHighlight}
      />
    ),
    [bookName, chapter, highlighted, fontSize, useSerif, tok, toggleHighlight],
  );

  const header = useMemo(
    () => (
      <View className="mb-7 items-center">
        <Text
          className="mb-1 font-ui-sb text-[12px] uppercase tracking-[1px]"
          style={{ color: tok.text3 }}
        >
          {bookName}
        </Text>
        <Text
          style={{
            fontSize: 40,
            lineHeight: 44,
            color: tok.text1,
            fontFamily: useSerif ? 'Lora_600SemiBold' : 'Jakarta_700Bold',
          }}
        >
          {chapter}
        </Text>
      </View>
    ),
    [tok, useSerif, bookName, chapter],
  );

  const footer = useMemo(
    () => (
      <View
        className="mt-12 flex-row items-center justify-between pt-6"
        style={{ borderTopWidth: 1, borderTopColor: tok.border }}
      >
        <ChapterButton
          label={`${bookName} ${chapter - 1}`}
          direction="prev"
          tok={tok}
          disabled={chapter <= 1}
          onPress={() => goToChapter(chapter - 1)}
        />
        <Text className="font-ui text-[12px]" style={{ color: tok.text3 }}>
          {verses.length} {verses.length === 1 ? 'verse' : 'verses'}
        </Text>
        <ChapterButton
          label={`${bookName} ${chapter + 1}`}
          direction="next"
          tok={tok}
          disabled={chapterCount !== null && chapter >= chapterCount}
          onPress={() => goToChapter(chapter + 1)}
        />
      </View>
    ),
    [tok, bookName, chapter, verses.length, goToChapter, chapterCount],
  );

  return (
    <View className="flex-1" style={{ backgroundColor: tok.bg }}>
      {/* ── Reader header ─────────────────────────────────────────────── */}
      <View
        className="flex-row items-center gap-2 px-4 pb-3"
        style={{
          paddingTop: insets.top + 10,
          backgroundColor: tok.raised,
          borderBottomWidth: 1,
          borderBottomColor: tok.border,
        }}
      >
        <Pressable
          onPress={() => setShowBooks(true)}
          accessibilityRole="button"
          accessibilityLabel={`Choose a book. Currently ${bookName} ${chapter}`}
          className="h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-sm"
          style={{ backgroundColor: tok.bg, borderWidth: 1, borderColor: tok.border }}
        >
          <Text className="font-ui-sb text-[15px]" style={{ color: tok.text1 }}>
            {bookName} {chapter}
          </Text>
          <Icon name="chevronDown" size={16} color={tok.text2} />
        </Pressable>

        <Pressable
          onPress={() => setShowTranslations((s) => !s)}
          accessibilityRole="button"
          accessibilityLabel={`Translation: ${translationCode}`}
          className="h-10 flex-row items-center gap-1 rounded-sm px-3.5"
          style={{ backgroundColor: tok.bg, borderWidth: 1, borderColor: tok.border }}
        >
          <Text className="font-ui-sb text-[13px]" style={{ color: tok.text2 }}>
            {translationCode}
          </Text>
          <Icon name="chevronDown" size={14} color={tok.text3} />
        </Pressable>

        <Pressable
          onPress={() => setBookmarked((b) => !b)}
          accessibilityRole="button"
          accessibilityLabel={bookmarked ? 'Remove bookmark' : 'Bookmark passage'}
          className="h-10 w-10 items-center justify-center rounded-sm"
          style={{ backgroundColor: tok.bg, borderWidth: 1, borderColor: tok.border }}
        >
          <Icon
            name="bookmark"
            size={18}
            color={bookmarked ? tok.accent : tok.text2}
            filled={bookmarked}
          />
        </Pressable>
      </View>

      {showTranslations && (
        <View
          className="absolute right-4 z-30 overflow-hidden rounded-md"
          style={{
            top: insets.top + 58,
            backgroundColor: tok.raised,
            borderWidth: 1,
            borderColor: tok.border,
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 4 },
            elevation: 12,
          }}
        >
          {(translations.data ?? []).map((t) => (
            <Pressable
              key={t.id}
              onPress={() => {
                setTranslation(t.code);
                setShowTranslations(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: t.code === translationCode }}
              className="px-5 py-3"
              style={{
                backgroundColor: t.code === translationCode ? tok.highlight : 'transparent',
              }}
            >
              <Text
                className={
                  t.code === translationCode ? 'font-ui-sb text-[15px]' : 'font-ui text-[15px]'
                }
                style={{ color: t.code === translationCode ? tok.accent : tok.text1 }}
              >
                {t.code}
              </Text>
            </Pressable>
          ))}
          {translations.isPending && (
            <Text className="px-5 py-3 font-ui text-[13px]" style={{ color: tok.text3 }}>
              Loading…
            </Text>
          )}
        </View>
      )}

      {/* ── The text ──────────────────────────────────────────────────── */}
      {passage.isPending ? (
        <View className="pt-8">
          <ListSkeleton rows={6} height={64} />
        </View>
      ) : passage.isError ? (
        <View className="flex-1 justify-center">
          <ErrorState error={passage.error} onRetry={passage.refetch} />
        </View>
      ) : verses.length === 0 ? (
        // An unimported passage is a valid address with no text yet — not an
        // error, and never a 404 from the API.
        <View className="flex-1 items-center justify-center px-8">
          <Text className="mb-2 text-center font-ui-b text-[17px]" style={{ color: tok.text1 }}>
            Nothing to show for {bookName} {chapter}
          </Text>
          <Text className="text-center font-ui text-[13px] leading-5" style={{ color: tok.text3 }}>
            Try another chapter, or pick a different translation.
          </Text>
        </View>
      ) : (
        /* Virtualised: this chapter is short but Psalm 119 is 176 verses, and
           the reader has to stay smooth on cheap Android hardware.
           `Animated.FlatList` rather than a plain one so `onScroll` binds to a
           worklet — the chrome then retracts without waking the JS thread.
           Verse heights vary with the font-size control, so no fixed-size list:
           measurement has to stay dynamic. */
        <Animated.FlatList
          data={verses}
          keyExtractor={keyOfVerse}
          renderItem={renderVerse}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: navClearance,
          }}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          // Rows are memoised, so they need telling when something outside
          // `data` changes their appearance.
          extraData={`${fontSize}-${useSerif}-${theme}-${highlighted.size}`}
        />
      )}

      {/* ── Floating reader toolbar ───────────────────────────────────── */}
      <Animated.View
        pointerEvents="box-none"
        className="absolute self-center"
        // Sits just above the floating nav bar, matching the design's 80px
        // offset. The nav no longer occupies layout space, so this has to clear
        // it explicitly or the two controls overlap.
        style={[{ bottom: NAV.barHeight + insets.bottom + 12 }, toolbarStyle]}
      >
        <View
          className="flex-row items-center overflow-hidden rounded-lg"
          style={{
            backgroundColor: tok.raised,
            borderWidth: 1,
            borderColor: tok.border,
            shadowColor: '#000',
            shadowOpacity: 0.14,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 4 },
            elevation: 14,
          }}
        >
          {(['light', 'sepia', 'dark'] as ReaderTheme[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTheme(t)}
              accessibilityRole="button"
              accessibilityLabel={`${t} reading theme`}
              accessibilityState={{ selected: theme === t }}
              className="h-11 w-12 items-center justify-center"
              style={{
                backgroundColor: theme === t ? READER_TOKENS[t].raised : 'transparent',
                borderRightWidth: 1,
                borderRightColor: tok.border,
              }}
            >
              {t === 'light' && (
                <Icon name="sun" size={18} color={theme === t ? tok.accent : tok.text2} />
              )}
              {t === 'sepia' && (
                <Icon name="coffee" size={18} color={theme === t ? tok.accent : tok.text2} />
              )}
              {t === 'dark' && (
                <Icon name="moon" size={18} color={theme === t ? tok.accent : tok.text2} />
              )}
            </Pressable>
          ))}

          <Pressable
            onPress={() => setFontSize((s) => Math.max(FONT_MIN, s - FONT_STEP))}
            disabled={fontSize <= FONT_MIN}
            accessibilityRole="button"
            accessibilityLabel="Decrease text size"
            className="h-11 w-11 items-center justify-center"
            style={{ opacity: fontSize <= FONT_MIN ? 0.35 : 1 }}
          >
            <Text className="font-ui-md text-[17px]" style={{ color: tok.text2 }}>
              A
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setFontSize((s) => Math.min(FONT_MAX, s + FONT_STEP))}
            disabled={fontSize >= FONT_MAX}
            accessibilityRole="button"
            accessibilityLabel="Increase text size"
            className="h-11 w-11 items-center justify-center"
            style={{ opacity: fontSize >= FONT_MAX ? 0.35 : 1 }}
          >
            <Text className="font-ui-sb text-[24px]" style={{ color: tok.text2 }}>
              A
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setUseSerif((s) => !s)}
            accessibilityRole="button"
            accessibilityLabel={useSerif ? 'Switch to sans-serif' : 'Switch to serif'}
            accessibilityState={{ selected: useSerif }}
            className="h-11 w-12 items-center justify-center"
            style={{
              backgroundColor: useSerif ? tok.highlight : 'transparent',
              borderLeftWidth: 1,
              borderLeftColor: tok.border,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                color: useSerif ? tok.accent : tok.text2,
                fontFamily: useSerif ? 'Lora_600SemiBold' : 'Jakarta_700Bold',
              }}
            >
              Aa
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      <PassagePicker
        visible={showBooks}
        tok={tok}
        currentOsis={book}
        currentChapter={chapter}
        books={books.data ?? []}
        loading={books.isPending}
        onPick={(nextOsis, nextChapter) => {
          setBook(nextOsis);
          setChapter(nextChapter);
          setHighlighted(new Set());
          setShowBooks(false);
        }}
        onClose={() => setShowBooks(false)}
      />
    </View>
  );
}

const keyOfVerse = (v: BibleVerse) => v.id;

// ─── A verse ───────────────────────────────────────────────────────────────

/**
 * Memoised so scrolling only re-renders rows entering the viewport. Without
 * this, the `highlighted` Set identity change on every tap would re-render the
 * whole chapter.
 */
const VerseRow = memo(function VerseRow({
  verse,
  reference,
  highlighted,
  fontSize,
  useSerif,
  tok,
  onPress,
}: {
  verse: BibleVerse;
  reference: string;
  highlighted: boolean;
  fontSize: number;
  useSerif: boolean;
  tok: ReaderTokens;
  onPress: (n: number) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(verse.number)}
      accessibilityRole="button"
      // Screen readers should announce the reference, then the text
      // (09-design-principles.md: "verse structure exposed meaningfully").
      accessibilityLabel={`${reference} verse ${verse.number}. ${verse.text}`}
      accessibilityState={{ selected: highlighted }}
      className="-mx-2 rounded-sm px-2 py-1"
      style={{ backgroundColor: highlighted ? tok.highlight : 'transparent' }}
    >
      <Text
        style={{
          fontSize,
          lineHeight: fontSize * 1.65,
          color: tok.text1,
          fontFamily: useSerif ? 'Lora_400Regular' : 'Jakarta_400Regular',
        }}
      >
        <Text
          style={{
            fontSize: fontSize * 0.6,
            lineHeight: fontSize * 1.65,
            color: tok.text3,
            fontFamily: 'Jakarta_600SemiBold',
          }}
        >
          {verse.number}{'  '}
        </Text>
        {verse.text}
      </Text>
    </Pressable>
  );
});

// ─── Chapter navigation ────────────────────────────────────────────────────

function ChapterButton({
  label,
  direction,
  tok,
  disabled,
  onPress,
}: {
  label: string;
  direction: 'prev' | 'next';
  tok: ReaderTokens;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Go to ${label}`}
      accessibilityState={{ disabled }}
      className="flex-row items-center gap-2 rounded-md px-4 py-3"
      style={{ borderWidth: 1, borderColor: tok.border, opacity: disabled ? 0.35 : 1 }}
    >
      {direction === 'prev' && <Icon name="chevronLeft" size={18} color={tok.text2} />}
      <Text className="font-ui-sb text-[14px]" style={{ color: tok.text2 }}>
        {label}
      </Text>
      {direction === 'next' && <Icon name="chevronRight" size={18} color={tok.text2} />}
    </Pressable>
  );
}

