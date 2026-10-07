import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { useCurrentLesson } from '../../src/api/queries';
import type { ManualDetail } from '../../src/api/types';
import { Icon } from '../../src/components/Icon';
import {
  hasTeacherNotes,
  lessonActivities,
  lessonParts,
  lessonQuestions,
  lessonResources,
  paragraphs,
  type LessonPart,
} from '../../src/data/lesson';
import { TEXT_SIZES, useReader } from '../../src/state/reader';
import { useTeacherTools } from '../../src/state/teacher';
import { Object3D } from '../../src/ui/art';
import { OptionRow, Toggle } from '../../src/ui/inputs';
import { Press } from '../../src/ui/Press';
import { EmptyState, HEADER_GAP, IconButton, Sheet, Skeleton } from '../../src/ui/screen';
import { useTokens } from '../../src/theme/ThemeProvider';
import { ELEVATION, POP } from '../../src/theme/tokens';

const TABS = [
  { value: 'lesson', label: 'Lesson' },
  { value: 'notes', label: 'Teacher notes' },
  { value: 'questions', label: 'Questions' },
] as const;

type Tab = (typeof TABS)[number]['value'];

const KEEP_AWAKE_TAG = 'teaching';

/**
 * This week's lesson (Figma "Lesson · Teaching mode" and "Lesson · Teacher
 * notes").
 *
 * `docs/CONSOLE-FIGMA-PROMPT.md` calls this the Teacher's "most-used screen in
 * the whole Console, so design it as a reading experience, not a record view".
 * Hence the big serif, one part at a time, a screen that does not dim, and a
 * Next button a thumb can find without looking down.
 */
export default function LessonScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tools = useTeacherTools();
  const reader = useReader();

  const lesson = useCurrentLesson(tools.lesson);
  const manual = lesson.data;

  const [tab, setTab] = useState<Tab>('lesson');
  const [index, setIndex] = useState(0);
  const [awake, setAwake] = useState(true);
  const [sizing, setSizing] = useState(false);
  const scroll = useRef<ScrollView>(null);

  const parts = useMemo(() => (manual ? lessonParts(manual) : []), [manual]);
  const part = parts[Math.min(index, parts.length - 1)];

  // Hold the screen on while this lesson is open, and let it go on the way
  // out. Nothing to hold on the web preview.
  useEffect(() => {
    if (Platform.OS === 'web' || !awake || !manual) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [awake, manual]);

  // Each part and each tab starts at its top.
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [index, tab]);

  const back = () => router.replace('/console');
  // The reader's own sizes, so one choice in Settings covers both places. The
  // lesson is read from further away than a Bible, so it starts a step bigger.
  const scale = reader.fontSize / 18;

  if (!tools.lesson) {
    return (
      <Shell title="Lesson" onBack={back} top={insets.top}>
        <View className="flex-1 justify-center">
          <EmptyState
            drawing="sitting"
            message="Lessons are for teachers and leaders."
            actionLabel="Back"
            onAction={back}
          />
        </View>
      </Shell>
    );
  }

  if (lesson.isPending) {
    return (
      <Shell title="Lesson" onBack={back} top={insets.top}>
        <View className="gap-4 px-5 pt-3">
          <Skeleton height={48} radius={999} />
          <Skeleton width="40%" height={16} radius={6} />
          <Skeleton width="85%" height={40} radius={8} />
          <Skeleton height={128} radius={12} />
          <Skeleton height={128} radius={12} />
        </View>
      </Shell>
    );
  }

  if (!manual) {
    return (
      <Shell title="Lesson" onBack={back} top={insets.top}>
        <View className="flex-1 justify-center">
          <EmptyState
            drawing={lesson.isError ? 'sitting' : 'reading'}
            message={
              lesson.isError
                ? 'We couldn’t load this week’s lesson. Check your connection, then try again.'
                : 'No lesson has been published for this week yet. It will show here as soon as it is.'
            }
            actionLabel={lesson.isError ? 'Try again' : undefined}
            onAction={() => lesson.refetch()}
          />
        </View>
      </Shell>
    );
  }

  const subtitle = [`Week ${manual.week_number}`, manual.series_detail?.title]
    .filter(Boolean)
    .join(' · ');

  return (
    <Shell
      title={manual.title}
      subtitle={subtitle}
      onBack={back}
      top={insets.top}
      onTextSize={() => setSizing(true)}
    >
      {/* ── Lesson / Teacher notes / Questions ─────────────────────────── */}
      <View className="px-5 pb-2 pt-1">
        <View accessibilityRole="tablist" className="flex-row rounded-full bg-surf-sunken p-1">
          {TABS.map((item) => {
            const selected = item.value === tab;
            return (
              <Press
                key={item.value}
                onPress={() => setTab(item.value)}
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected }}
                className={`h-10 flex-1 items-center justify-center rounded-full ${
                  selected ? 'bg-ink' : ''
                }`}
              >
                <Text
                  numberOfLines={1}
                  className={`font-ui-sb text-[14px] leading-5 ${
                    selected ? 'text-on-ink' : 'text-ink-2'
                  }`}
                >
                  {item.label}
                </Text>
              </Press>
            );
          })}
        </View>
      </View>

      <ScrollView
        ref={scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
      >
        {tab === 'lesson' &&
          (part ? (
            <>
              <LessonBody part={part} number={index + 1} manual={manual} scale={scale} />
              <View className="w-full flex-row items-center gap-2.5 rounded-full bg-surf-sunken px-3.5 py-2.5">
                <Text className="flex-1 font-ui-sb text-[14px] leading-5 text-ink-1">
                  Keep screen on while teaching
                </Text>
                <Toggle on={awake} onChange={setAwake} label="Keep screen on while teaching" />
              </View>
            </>
          ) : (
            <EmptyState
              drawing="reading"
              message="This lesson has a title and a verse, but its text has not been written yet."
            />
          ))}

        {tab === 'notes' && <TeacherNotes manual={manual} />}
        {tab === 'questions' && <Questions manual={manual} />}
      </ScrollView>

      {/* ── Pager ──────────────────────────────────────────────────────── */}
      {tab === 'lesson' && parts.length > 1 && (
        <Pager index={index} total={parts.length} onChange={setIndex} />
      )}

      <Sheet visible={sizing} onClose={() => setSizing(false)}>
        <View className="w-full gap-3 pt-2">
          <Text
            accessibilityRole="header"
            className="font-ui-b text-[20px] leading-7 tracking-[-0.2px] text-ink-1"
          >
            Reading text size
          </Text>
          {TEXT_SIZES.map((size) => (
            <OptionRow
              key={size.value}
              title={size.label}
              selected={reader.fontSize === size.value}
              onPress={() => {
                reader.setFontSize(size.value);
                setSizing(false);
              }}
            />
          ))}
        </View>
      </Sheet>
    </Shell>
  );
}

/** Back, the lesson's name over its week, and the text-size button. */
function Shell({
  title,
  subtitle,
  onBack,
  onTextSize,
  top,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  onTextSize?: () => void;
  top: number;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-1 bg-surf-base">
      <View
        className="flex-row items-center gap-3 pb-1 pl-4 pr-5"
        style={{ paddingTop: top + HEADER_GAP }}
      >
        <IconButton icon="chevronLeft" label="Back to teacher home" onPress={onBack} />
        <View className="min-w-0 flex-1">
          <Text
            numberOfLines={1}
            accessibilityRole="header"
            className="font-ui-b text-[20px] leading-7 tracking-[-0.2px] text-ink-1"
          >
            {title}
          </Text>
          {!!subtitle && (
            <Text numberOfLines={1} className="font-ui-md text-[12px] leading-4 text-ink-3">
              {subtitle}
            </Text>
          )}
        </View>
        {onTextSize && <IconButton icon="text" label="Reading text size" onPress={onTextSize} />}
      </View>
      {children}
    </View>
  );
}

// ─── Lesson ────────────────────────────────────────────────────────────────

/** One part of the lesson, set to be read aloud from arm's length. */
function LessonBody({
  part,
  number,
  manual,
  scale,
}: {
  part: LessonPart;
  number: number;
  manual: ManualDetail;
  scale: number;
}) {
  const body = { fontSize: Math.round(22 * scale), lineHeight: Math.round(32 * scale) };

  return (
    <>
      <Text className="font-ui-md text-[12px] uppercase leading-4 tracking-[0.96px] text-ink-3">
        Part {number} · {part.eyebrow}
      </Text>
      <Text
        accessibilityRole="header"
        className="font-ui-xb text-[32px] leading-10 tracking-[-0.64px] text-ink-1"
      >
        {part.title}
      </Text>

      {part.paragraphs.map((text, i) => (
        <Text key={i} className="font-read-md text-ink-1" style={body}>
          {text}
        </Text>
      ))}

      {part.bullets.map((text, i) => (
        <View key={i} className="flex-row gap-3">
          <View className="h-2 w-2 rounded-full bg-ink" style={{ marginTop: body.lineHeight / 2 - 4 }} />
          <Text className="flex-1 font-read-md text-ink-1" style={body}>
            {text}
          </Text>
        </View>
      ))}

      {part.withVerse && !!manual.memory_verse_text && (
        <View className="w-full gap-1.5 rounded-2xl bg-pop-amber p-4">
          <Text className="font-ui-md text-[12px] uppercase leading-4 tracking-[0.96px] text-pop-on">
            Say it together
          </Text>
          <Text className="font-ui-b text-[17px] leading-6 text-pop-on">
            “{manual.memory_verse_text.replace(/^["“]|["”]$/g, '')}”
          </Text>
          <Text className="font-ui-sb text-[14px] leading-5 text-pop-on">{manual.memory_verse}</Text>
        </View>
      )}
    </>
  );
}

/** Previous, where you are, Next (Figma "pager"). */
function Pager({
  index,
  total,
  onChange,
}: {
  index: number;
  total: number;
  onChange: (index: number) => void;
}) {
  const tokens = useTokens();
  const first = index === 0;
  const last = index === total - 1;

  return (
    <View className="flex-row items-center gap-2.5 px-5 py-2">
      <Press
        onPress={() => onChange(index - 1)}
        disabled={first}
        accessibilityLabel="Previous part"
        className="h-14 w-14 items-center justify-center rounded-full bg-surf-sunken"
        style={{ opacity: first ? 0.4 : 1 }}
      >
        <Icon name="chevronLeft" size={22} color={tokens.text1} />
      </Press>

      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Part ${index + 1} of ${total}`}
        accessibilityValue={{ min: 1, max: total, now: index + 1 }}
        className="flex-1 items-center gap-1.5"
      >
        <Text className="font-ui-sb text-[14px] leading-5 text-ink-1">
          Part {index + 1} of {total}
        </Text>
        {/* A long manual would run the dots off the screen; the words carry it. */}
        {total <= 10 && (
          <View className="flex-row gap-1">
            {Array.from({ length: total }, (_, i) => (
              <View
                key={i}
                className={`h-2 rounded-full ${i === index ? 'w-6' : 'w-2'} ${
                  i <= index ? 'bg-ink' : 'bg-line-strong'
                }`}
              />
            ))}
          </View>
        )}
      </View>

      <Press
        onPress={() => onChange(index + 1)}
        disabled={last}
        accessibilityLabel="Next part"
        className={`h-14 flex-row items-center gap-1 rounded-full pl-[22px] pr-4 ${
          last ? 'bg-line' : 'bg-ink'
        }`}
      >
        <Text className={`font-ui-sb text-[16px] leading-6 ${last ? 'text-ink-3' : 'text-on-ink'}`}>
          Next
        </Text>
        <Icon name="chevronRight" size={20} color={last ? tokens.text3 : tokens.onInk} />
      </Press>
    </View>
  );
}

// ─── Teacher notes ─────────────────────────────────────────────────────────

/**
 * The teacher's half of the manual.
 *
 * The banner is a statement, not a lock: the server only sends these fields to
 * someone who holds `content.view`, so a teen's app never receives them.
 */
function TeacherNotes({ manual }: { manual: ManualDetail }) {
  const tokens = useTokens();
  const notes = paragraphs(manual.teacher_notes);
  const guide = paragraphs(manual.discussion_guide);
  const activities = lessonActivities(manual);
  const resources = lessonResources(manual);

  return (
    <>
      <View className="w-full flex-row items-center gap-2 rounded-full bg-pop-violet py-2.5 pl-2.5 pr-3.5">
        {/* Always dark with a light mark: it sits on violet in both themes. */}
        <View className="h-7 w-7 items-center justify-center rounded-full bg-pop-on">
          <Icon name="lock" size={14} color="#FDFAF5" />
        </View>
        <Text className="flex-1 font-ui-md text-[12px] uppercase leading-4 tracking-[0.72px] text-pop-on">
          Teachers only · Teens never see this
        </Text>
      </View>

      {!hasTeacherNotes(manual) && (
        <EmptyState
          drawing="reading"
          message="No teacher notes were written for this lesson. The lesson and its questions are all there is this week."
        />
      )}

      {notes.length > 0 && <NoteCard title="Before you start" paragraphs={notes} />}
      {guide.length > 0 && <NoteCard title="Leading the discussion" paragraphs={guide} />}

      {activities.map((activity, i) => (
        // Extra room above the first one for the target that breaks out of it.
        <View
          key={i}
          className={`w-full gap-1 rounded-2xl bg-pop-sky p-4 ${i === 0 ? 'mt-2' : ''}`}
        >
          <Text className="font-ui-md text-[12px] uppercase leading-4 tracking-[0.96px] text-pop-on">
            Activity
          </Text>
          <Text className={`font-ui-b text-[17px] leading-6 text-pop-on ${i === 0 ? 'pr-14' : ''}`}>
            {activity.title}
          </Text>
          {!!activity.detail && (
            <Text className="font-ui text-[14px] leading-5 text-pop-on">{activity.detail}</Text>
          )}
          {i === 0 && (
            <View pointerEvents="none" style={{ position: 'absolute', right: 10, top: -14 }}>
              <Object3D name="target" size={60} />
            </View>
          )}
        </View>
      ))}

      {resources.length > 0 && (
        <View className="w-full gap-1 rounded-2xl bg-surf-raised px-4 py-3" style={ELEVATION.card}>
          <Text className="font-ui-md text-[12px] uppercase leading-4 tracking-[0.96px] text-ink-3">
            More to use
          </Text>
          {resources.map((resource, i) =>
            resource.url ? (
              <Press
                key={i}
                onPress={() => Linking.openURL(resource.url as string).catch(() => {})}
                scaleTo={0.985}
                accessibilityRole="link"
                accessibilityLabel={resource.label}
                className="min-h-[44px] flex-row items-center gap-3"
              >
                <Text numberOfLines={2} className="flex-1 font-ui-sb text-[16px] leading-6 text-ink-1">
                  {resource.label}
                </Text>
                <Icon name="arrowRight" size={18} color={tokens.text1} />
              </Press>
            ) : (
              <Text key={i} className="py-2.5 font-ui text-[16px] leading-6 text-ink-1">
                {resource.label}
              </Text>
            ),
          )}
        </View>
      )}
    </>
  );
}

function NoteCard({ title, paragraphs: body }: { title: string; paragraphs: string[] }) {
  return (
    <View className="w-full gap-1.5 rounded-2xl bg-surf-raised p-4" style={ELEVATION.card}>
      <Text accessibilityRole="header" className="font-ui-b text-[17px] leading-6 text-ink-1">
        {title}
      </Text>
      {body.map((text, i) => (
        <Text key={i} className="font-ui text-[16px] leading-6 text-ink-2">
          {text}
        </Text>
      ))}
    </View>
  );
}

// ─── Questions ─────────────────────────────────────────────────────────────

/** What to ask, and what a good answer sounds like when the manual says. */
function Questions({ manual }: { manual: ManualDetail }) {
  const questions = lessonQuestions(manual);

  if (questions.length === 0) {
    return (
      <EmptyState drawing="reading" message="No discussion questions were written for this lesson." />
    );
  }

  return (
    <>
      {questions.map((question, i) => (
        <View
          key={i}
          className="w-full gap-2 rounded-2xl bg-surf-raised p-4"
          style={ELEVATION.card}
        >
          <Text className="font-ui-md text-[12px] uppercase leading-4 tracking-[0.96px] text-ink-3">
            Ask
          </Text>
          <Text className="font-ui-sb text-[16px] leading-6 text-ink-1">{question.ask}</Text>
          {!!question.listenFor && (
            <View className="w-full gap-1 rounded-xl p-3" style={{ backgroundColor: POP.lime }}>
              <Text className="font-ui-md text-[12px] uppercase leading-4 tracking-[0.96px] text-pop-on">
                Listen for
              </Text>
              <Text className="font-ui text-[14px] leading-5 text-pop-on">{question.listenFor}</Text>
            </View>
          )}
        </View>
      ))}
    </>
  );
}
