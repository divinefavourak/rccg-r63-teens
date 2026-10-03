import { memo } from 'react';
import { Text, View, type ViewProps } from 'react-native';
import { Image } from 'expo-image';

import { Icon, type IconName } from '../components/Icon';
import { Drawing, DrawingIn, Object3D, type DrawingName, type ObjectName } from './art';
import { Press } from './Press';
import { useTokens } from '../theme/ThemeProvider';
import { ELEVATION, POP, type PopColour } from '../theme/tokens';

export const POP_BG: Record<PopColour, string> = {
  green: 'bg-pop-green',
  amber: 'bg-pop-amber',
  violet: 'bg-pop-violet',
  pink: 'bg-pop-pink',
  sky: 'bg-pop-sky',
  lime: 'bg-pop-lime',
};

// ─── Colour block ──────────────────────────────────────────────────────────

/**
 * A saturated colour-block card. Text on it is always `text-pop-on`: the pop
 * colours do not change between light and dark, so neither does their text.
 *
 * Deliberately not `overflow-hidden` — 3D objects are meant to break out of
 * the card's edge.
 */
export function PopCard({
  colour,
  children,
  onPress,
  accessibilityLabel,
  className = '',
  style,
}: {
  colour: PopColour;
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  className?: string;
  style?: ViewProps['style'];
}) {
  const classes = `rounded-2xl p-4 ${POP_BG[colour]} ${className}`;
  if (!onPress) {
    return (
      <View className={classes} style={style}>
        {children}
      </View>
    );
  }
  return (
    <Press
      onPress={onPress}
      scaleTo={0.98}
      accessibilityLabel={accessibilityLabel}
      className={classes}
      style={style}
    >
      {children}
    </Press>
  );
}

/** The spaced uppercase label that opens a colour-block card. */
export function PopEyebrow({ children }: { children: string }) {
  return (
    <Text className="font-ui-md text-[12px] uppercase leading-4 tracking-[0.72px] text-pop-on">
      {children}
    </Text>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────

/**
 * The one big thing on a screen (Figma "App/Hero Card"). The drawing sits in
 * the lower right and a 3D object breaks out of the top-right corner.
 */
export function HeroCard({
  eyebrow,
  title,
  detail,
  actionLabel,
  onPress,
  colour = 'green',
  drawing,
  drawingWidth = 171,
  object,
  play = false,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  actionLabel: string;
  onPress: () => void;
  colour?: PopColour;
  drawing?: DrawingName;
  /** Wide drawings suit the default; give a tall one less. */
  drawingWidth?: number;
  object?: ObjectName;
  /** The action starts something playing: a play mark leads the label. */
  play?: boolean;
}) {
  const tokens = useTokens();
  return (
    <Press
      onPress={onPress}
      scaleTo={0.985}
      accessibilityLabel={`${title}. ${actionLabel}`}
      className={`w-full gap-2 rounded-3xl p-5 ${POP_BG[colour]}`}
    >
      {drawing && (
        <View pointerEvents="none" style={{ position: 'absolute', right: -6, bottom: 12 }}>
          <Drawing name={drawing} width={drawingWidth} />
        </View>
      )}
      {object && (
        <View pointerEvents="none" style={{ position: 'absolute', right: -16, top: -26 }}>
          <Object3D name={object} size={92} />
        </View>
      )}
      <Text className="pr-16 font-ui-md text-[12px] uppercase leading-4 tracking-[0.96px] text-pop-on">
        {eyebrow}
      </Text>
      {/* The title keeps to the left ~60% so it never runs under the drawing.
          A long one steps down a size rather than being cut off: real titles
          are longer than the two words the card was drawn with. */}
      <Text
        numberOfLines={title.length > 34 ? 4 : 3}
        className={`w-[62%] font-ui-xb text-pop-on ${
          title.length > 34
            ? 'text-[24px] leading-8 tracking-[-0.36px]'
            : title.length > 16
              ? 'text-[32px] leading-10 tracking-[-0.64px]'
              : 'text-[40px] leading-[48px] tracking-[-1.2px]'
        }`}
      >
        {title}
      </Text>
      {detail && (
        <Text className="w-[62%] font-ui-sb text-[14px] leading-5 text-pop-on">{detail}</Text>
      )}
      {play ? (
        <View className="h-11 flex-row items-center gap-2 self-start rounded-full bg-ink pl-2 pr-5">
          <View className="h-7 w-7 items-center justify-center rounded-full bg-on-ink">
            <Icon name="play" size={14} color={tokens.ink} />
          </View>
          <Text className="font-ui-sb text-[14px] leading-5 text-on-ink">{actionLabel}</Text>
        </View>
      ) : (
        <View className="h-11 flex-row items-center gap-2 self-start rounded-full bg-ink pl-5 pr-2">
          <Text className="font-ui-sb text-[14px] leading-5 text-on-ink">{actionLabel}</Text>
          <View className="h-7 w-7 items-center justify-center rounded-full bg-on-ink">
            <Icon name="chevronRight" size={16} color={tokens.ink} />
          </View>
        </View>
      )}
    </Press>
  );
}

// ─── Week strip ────────────────────────────────────────────────────────────

export type WeekDayState = 'done' | 'today' | 'next';

/**
 * One day in the Today week strip (Figma "App/Week Pill"). Done days carry a
 * star, never colour alone.
 */
export const WeekPill = memo(function WeekPill({
  weekday,
  date,
  state,
}: {
  /** "Thu" */
  weekday: string;
  /** Day of the month. */
  date: number;
  state: WeekDayState;
}) {
  const shell =
    state === 'today'
      ? 'bg-ink'
      : state === 'done'
        ? 'border-[1.5px] border-ink'
        : 'border-[1.5px] border-line-strong';
  const text =
    state === 'today' ? 'text-on-ink' : state === 'done' ? 'text-ink-1' : 'text-ink-3';

  return (
    <View
      accessible
      accessibilityLabel={`${weekday} ${date}, ${
        state === 'done' ? 'done' : state === 'today' ? 'today' : 'coming up'
      }`}
      className={`h-[76px] w-10 items-center justify-center gap-0.5 rounded-full ${shell}`}
    >
      {state === 'done' ? (
        <Object3D name="star" size={18} />
      ) : state === 'today' ? (
        <View className="h-1.5 w-1.5 rounded-full bg-pop-green" />
      ) : (
        <View className="h-1.5 w-1.5" />
      )}
      <Text className={`font-ui-md text-[12px] leading-4 ${text}`}>{weekday}</Text>
      <Text className={`font-ui-sb text-[14px] leading-5 ${text}`}>{date}</Text>
    </View>
  );
});

// ─── Streak ────────────────────────────────────────────────────────────────

/**
 * Streak progress (Figma "Card/Streak"). Never uses the error colour and
 * never threatens loss (12-gamification.md).
 */
export function StreakCard({
  title,
  message,
  week,
}: {
  /** "12-day streak" */
  title: string;
  message: string;
  /** Seven days, Monday first. */
  week: { letter: string; state: WeekDayState }[];
}) {
  return (
    <PopCard colour="amber" className="w-full gap-4">
      <View className="flex-row items-center gap-3">
        <Object3D name="fire" size={56} />
        <View className="flex-1 gap-1">
          <Text className="font-ui-b text-[17px] leading-6 text-pop-on">{title}</Text>
          <Text className="font-ui text-[14px] leading-5 text-pop-on">{message}</Text>
        </View>
      </View>
      <View className="flex-row justify-between">
        {week.map((day, i) => (
          <View key={i} className="items-center gap-1">
            {day.state === 'done' ? (
              <View className="h-7 w-7 items-center justify-center rounded-full bg-pop-on">
                <Icon name="check" size={16} color={POP.amber} />
              </View>
            ) : day.state === 'today' ? (
              <View className="h-7 w-7 items-center justify-center rounded-full border-2 border-pop-on">
                <Icon name="check" size={16} color={POP.on} />
              </View>
            ) : (
              <View className="h-7 w-7 rounded-full bg-pop-on/[0.14]" />
            )}
            <Text className="font-ui-md text-[12px] leading-4 text-pop-on">{day.letter}</Text>
          </View>
        ))}
      </View>
    </PopCard>
  );
}

// ─── Decoration ────────────────────────────────────────────────────────────

/**
 * A soft colour circle that sits partly off-screen behind the auth screens.
 * Position it with `style` (`left` / `top` may be negative).
 */
export function Blob({
  colour,
  size,
  style,
}: {
  colour: PopColour;
  size: number;
  style?: ViewProps['style'];
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: POP[colour],
        },
        style,
      ]}
    />
  );
}

// ─── Library item ──────────────────────────────────────────────────────────

/**
 * An article, reading, video or podcast in a list (Figma "Card/Content"): a
 * square colour thumbnail, a small label, the title and one line of detail.
 * `trailing` is for one small control, such as the saved mark.
 */
export const ContentCard = memo(function ContentCard({
  eyebrow,
  title,
  detail,
  colour,
  drawing,
  image,
  onPress,
  trailing,
}: {
  eyebrow: string;
  title: string;
  detail?: string | null;
  colour: PopColour;
  drawing: DrawingName;
  /** A real cover, when the item has one. Replaces the drawing. */
  image?: string | null;
  onPress: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    // The card is a plain box holding two controls side by side: the item
    // itself and, when given, the trailing one. Nesting one inside the other
    // would put a button inside a button.
    <View
      className="w-full flex-row items-center gap-3 rounded-2xl bg-surf-raised p-3"
      style={ELEVATION.card}
    >
      <Press
        onPress={onPress}
        scaleTo={0.985}
        accessibilityLabel={`${title}. ${eyebrow}`}
        className="min-w-0 flex-1 flex-row items-center gap-3"
      >
        <View
          className={`h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-lg ${POP_BG[colour]}`}
        >
          {image ? (
            <Image
              source={image}
              contentFit="cover"
              cachePolicy="memory-disk"
              accessible={false}
              style={{ width: 88, height: 88 }}
            />
          ) : (
            <DrawingIn name={drawing} box={76} />
          )}
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <Text numberOfLines={1} className="font-ui-md text-[12px] uppercase leading-4 text-ink-3">
            {eyebrow}
          </Text>
          <Text numberOfLines={3} className="font-ui-b text-[17px] leading-6 text-ink-1">
            {title}
          </Text>
          {!!detail && (
            <Text numberOfLines={1} className="font-ui text-[14px] leading-5 text-ink-2">
              {detail}
            </Text>
          )}
        </View>
      </Press>
      {trailing}
    </View>
  );
});

// ─── Events ────────────────────────────────────────────────────────────────

/**
 * Weekday over day of the month (Figma "App/Date Badge"). Plain on a photo,
 * coloured in a list row.
 */
export const DateBadge = memo(function DateBadge({
  date,
  colour,
}: {
  date: Date;
  colour?: PopColour;
}) {
  const text = colour ? 'text-pop-on' : 'text-ink-1';
  return (
    <View
      className={`h-[60px] w-14 items-center justify-center rounded-lg ${
        colour ? POP_BG[colour] : 'bg-surf-raised'
      }`}
    >
      <Text className={`font-ui-md text-[12px] uppercase leading-4 ${text}`}>
        {date.toLocaleDateString('en-GB', { weekday: 'short' })}
      </Text>
      <Text className={`font-ui-b text-[20px] leading-7 tracking-[-0.2px] ${text}`}>
        {String(date.getDate()).padStart(2, '0')}
      </Text>
    </View>
  );
});

/** One fact about an event on a colour pill (Figma "App/Fact Chip"). */
export function FactChip({
  icon,
  colour,
  children,
}: {
  icon: IconName;
  colour: PopColour;
  children: string;
}) {
  return (
    <View
      className={`h-10 max-w-full flex-row items-center gap-1.5 rounded-full pl-2.5 pr-3.5 ${POP_BG[colour]}`}
    >
      <Icon name={icon} size={16} color={POP.on} />
      <Text numberOfLines={1} className="shrink font-ui-sb text-[14px] leading-5 text-pop-on">
        {children}
      </Text>
    </View>
  );
}

// ─── Numbers ───────────────────────────────────────────────────────────────

/** A number on a small colour tile, with a 3D object (Figma "App/Stat Tile"). */
export function StatTile({
  value,
  label,
  colour,
  object,
}: {
  /** Already formatted: "48", "1/2". */
  value: string;
  label: string;
  colour: PopColour;
  object: ObjectName;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className={`flex-1 gap-0.5 rounded-2xl pb-3 pl-[14px] pr-3 pt-[14px] ${POP_BG[colour]}`}
    >
      <Text
        numberOfLines={1}
        className="font-ui-xb text-[32px] leading-10 tracking-[-0.64px] text-pop-on"
      >
        {value}
      </Text>
      <Text numberOfLines={1} className="font-ui-md text-[12px] leading-4 text-pop-on">
        {label}
      </Text>
      <View pointerEvents="none" style={{ position: 'absolute', right: -2, top: -14 }}>
        <Object3D name={object} size={44} />
      </View>
    </View>
  );
}

// ─── People ────────────────────────────────────────────────────────────────

/**
 * A person: their photo, or the first letter of their name on amber until
 * they add one. `ring` is the width of the pale border drawn round it.
 */
export function Avatar({
  name,
  photo,
  size,
  ring = 0,
}: {
  name: string;
  photo?: string | null;
  size: number;
  ring?: number;
}) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={photo ? `Photo of ${name}` : name}
      className="items-center justify-center overflow-hidden rounded-full border-surf-raised bg-pop-amber"
      style={{ width: size, height: size, borderWidth: ring }}
    >
      {photo ? (
        <Image
          source={photo}
          contentFit="cover"
          cachePolicy="memory-disk"
          accessible={false}
          style={{ width: size, height: size }}
        />
      ) : (
        <Text className="font-ui-xb text-pop-on" style={{ fontSize: size * 0.4 }}>
          {name.trim().charAt(0).toUpperCase() || '?'}
        </Text>
      )}
    </View>
  );
}
