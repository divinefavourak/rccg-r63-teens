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
import { Grabber } from '../../src/components/ui';
import { useChrome } from '../../src/state/chrome';
import { BOOKS, PASSAGE, TRANSLATIONS, type Verse } from '../../src/data/content';
import { DURATION, READER_TOKENS, type ReaderTheme, type ReaderTokens } from '../../src/theme/tokens';

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
 */
export default function BibleScreen() {
  const insets = useSafeAreaInsets();
  const { navHidden } = useChrome();
  const reduceMotion = useReducedMotion();

  const [theme, setTheme] = useState<ReaderTheme>('light');
  const [translation, setTranslation] = useState('NLT');
  const [fontSize, setFontSize] = useState(18);
  const [useSerif, setUseSerif] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [showBooks, setShowBooks] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);
  const [highlighted, setHighlighted] = useState<ReadonlySet<number>>(() => new Set([16]));

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

  const renderVerse = useCallback(
    ({ item }: { item: Verse }) => (
      <VerseRow
        verse={item}
        highlighted={highlighted.has(item.n)}
        fontSize={fontSize}
        useSerif={useSerif}
        tok={tok}
        onPress={toggleHighlight}
      />
    ),
    [highlighted, fontSize, useSerif, tok, toggleHighlight],
  );

  const header = useMemo(
    () => (
      <View className="mb-7 items-center">
        <Text
          className="mb-1 font-ui-sb text-[12px] uppercase tracking-[1px]"
          style={{ color: tok.text3 }}
        >
          {PASSAGE.book}
        </Text>
        <Text
          style={{
            fontSize: 40,
            lineHeight: 44,
            color: tok.text1,
            fontFamily: useSerif ? 'Lora_600SemiBold' : 'Jakarta_700Bold',
          }}
        >
          {PASSAGE.chapter}
        </Text>
      </View>
    ),
    [tok, useSerif],
  );

  const footer = useMemo(
    () => (
      <View
        className="mt-12 flex-row items-center justify-between pt-6"
        style={{ borderTopWidth: 1, borderTopColor: tok.border }}
      >
        <ChapterButton label={`${PASSAGE.book} ${PASSAGE.chapter - 1}`} direction="prev" tok={tok} />
        <Text className="font-ui text-[12px]" style={{ color: tok.text3 }}>
          {PASSAGE.verses.length} verses
        </Text>
        <ChapterButton label={`${PASSAGE.book} ${PASSAGE.chapter + 1}`} direction="next" tok={tok} />
      </View>
    ),
    [tok],
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
          accessibilityLabel={`Choose a book. Currently ${PASSAGE.book} ${PASSAGE.chapter}`}
          className="h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-sm"
          style={{ backgroundColor: tok.bg, borderWidth: 1, borderColor: tok.border }}
        >
          <Text className="font-ui-sb text-[15px]" style={{ color: tok.text1 }}>
            {PASSAGE.book} {PASSAGE.chapter}
          </Text>
          <Icon name="chevronDown" size={16} color={tok.text2} />
        </Pressable>

        <Pressable
          onPress={() => setShowTranslations((s) => !s)}
          accessibilityRole="button"
          accessibilityLabel={`Translation: ${translation}`}
          className="h-10 flex-row items-center gap-1 rounded-sm px-3.5"
          style={{ backgroundColor: tok.bg, borderWidth: 1, borderColor: tok.border }}
        >
          <Text className="font-ui-sb text-[13px]" style={{ color: tok.text2 }}>
            {translation}
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
          {TRANSLATIONS.map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                setTranslation(t);
                setShowTranslations(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: t === translation }}
              className="px-5 py-3"
              style={{ backgroundColor: t === translation ? tok.highlight : 'transparent' }}
            >
              <Text
                className={t === translation ? 'font-ui-sb text-[15px]' : 'font-ui text-[15px]'}
                style={{ color: t === translation ? tok.accent : tok.text1 }}
              >
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* ── The text ──────────────────────────────────────────────────── */}
      {/* Virtualised: this chapter is 21 verses but Psalm 119 is 176, and the
          reader has to stay smooth on cheap Android hardware.
          `Animated.FlatList` rather than a plain one so `onScroll` binds to a
          worklet — the chrome then retracts without waking the JS thread.
          Verse heights vary with the font-size control, so no fixed-size
          list: measurement has to stay dynamic. */}
      <Animated.FlatList
        data={PASSAGE.verses}
        keyExtractor={keyOfVerse}
        renderItem={renderVerse}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 120 }}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        // Rows are memoised, so they need telling when something outside
        // `data` changes their appearance.
        extraData={`${fontSize}-${useSerif}-${theme}-${highlighted.size}`}
      />

      {/* ── Floating reader toolbar ───────────────────────────────────── */}
      <Animated.View
        pointerEvents="box-none"
        className="absolute self-center"
        style={[{ bottom: 24 }, toolbarStyle]}
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

      <BookPicker
        visible={showBooks}
        tok={tok}
        current={PASSAGE.book}
        onClose={() => setShowBooks(false)}
      />
    </View>
  );
}

const keyOfVerse = (v: Verse) => String(v.n);

// ─── A verse ───────────────────────────────────────────────────────────────

/**
 * Memoised so scrolling only re-renders rows entering the viewport. Without
 * this, the `highlighted` Set identity change on every tap would re-render the
 * whole chapter.
 */
const VerseRow = memo(function VerseRow({
  verse,
  highlighted,
  fontSize,
  useSerif,
  tok,
  onPress,
}: {
  verse: Verse;
  highlighted: boolean;
  fontSize: number;
  useSerif: boolean;
  tok: ReaderTokens;
  onPress: (n: number) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(verse.n)}
      accessibilityRole="button"
      // Screen readers should announce the reference, then the text
      // (09-design-principles.md: "verse structure exposed meaningfully").
      accessibilityLabel={`${PASSAGE.book} ${PASSAGE.chapter} verse ${verse.n}. ${verse.text}`}
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
          {verse.n}{'  '}
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
}: {
  label: string;
  direction: 'prev' | 'next';
  tok: ReaderTokens;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Go to ${label}`}
      className="flex-row items-center gap-2 rounded-md px-4 py-3"
      style={{ borderWidth: 1, borderColor: tok.border }}
    >
      {direction === 'prev' && <Icon name="chevronLeft" size={18} color={tok.text2} />}
      <Text className="font-ui-sb text-[14px]" style={{ color: tok.text2 }}>
        {label}
      </Text>
      {direction === 'next' && <Icon name="chevronRight" size={18} color={tok.text2} />}
    </Pressable>
  );
}

// ─── Book picker ───────────────────────────────────────────────────────────

/**
 * A bottom sheet, not a dropdown: 10-design-system.md makes sheets the mobile
 * picker and the teen surface's workhorse.
 */
function BookPicker({
  visible,
  tok,
  current,
  onClose,
}: {
  visible: boolean;
  tok: ReaderTokens;
  current: string;
  onClose: () => void;
}) {
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
        accessibilityLabel="Close book picker"
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
          <Text className="px-5 pb-3 font-ui-b text-[17px]" style={{ color: tok.text1 }}>
            Choose a book
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {BOOKS.map((book) => (
              <Pressable
                key={book}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityState={{ selected: book === current }}
                className="px-5 py-3.5"
                style={{
                  backgroundColor: book === current ? tok.highlight : 'transparent',
                  borderBottomWidth: 1,
                  borderBottomColor: tok.border,
                }}
              >
                <Text
                  className={book === current ? 'font-ui-sb text-[15px]' : 'font-ui text-[15px]'}
                  style={{ color: book === current ? tok.accent : tok.text1 }}
                >
                  {book}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
