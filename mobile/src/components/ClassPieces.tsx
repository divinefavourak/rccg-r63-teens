import { memo } from 'react';
import { Text, View } from 'react-native';

import type { ClassMember } from '../api/types';
import { Avatar, colourFor } from '../ui/cards';
import { Press } from '../ui/Press';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** "Read on Monday and Tuesday", for a screen reader; the dots say it to the eye. */
function weekInWords(week: boolean[]): string {
  const read = DAYS.filter((_, i) => week[i]);
  if (read.length === 0) return 'Has not read yet this week';
  if (read.length === 7) return 'Read every day this week';
  return `Read on ${read.join(', ')}`;
}

/**
 * Seven dots, Monday to Sunday (Figma "week").
 *
 * A day without reading is an empty ring, the same on Wednesday as on a
 * Saturday that has not happened yet. Nothing is red and nothing is crossed
 * out: 12-gamification.md forbids marking a missed day as a failure.
 */
export const WeekDots = memo(function WeekDots({ week }: { week: boolean[] }) {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={weekInWords(week)}
      className="flex-row"
      style={{ gap: 3 }}
    >
      {DAYS.map((day, i) =>
        week[i] ? (
          <View key={day} className="h-3 w-3 rounded-full bg-pop-green" />
        ) : (
          <View key={day} className="h-3 w-3 rounded-full border border-line-strong bg-surf-sunken" />
        ),
      )}
    </View>
  );
});

/** "15 · 4 of 7 this week". The age is left off when the profile has none. */
export function weekLine(member: ClassMember): string {
  return [member.age, `${member.days_this_week} of 7 this week`].filter(Boolean).join(' · ');
}

/** One teen in a class list (Figma "teen"): photo, name, the week in a line and in dots. */
export const TeenRow = memo(function TeenRow({
  member,
  onPress,
}: {
  member: ClassMember;
  onPress: (member: ClassMember) => void;
}) {
  return (
    <Press
      onPress={() => onPress(member)}
      scaleTo={0.985}
      accessibilityLabel={`${member.name}. ${weekInWords(member.week)}`}
      className="h-16 w-full flex-row items-center gap-3"
    >
      <Avatar name={member.name} photo={member.photo} size={44} colour={colourFor(member.name)} />
      <View className="min-w-0 flex-1 gap-0.5">
        <Text numberOfLines={1} className="font-ui-sb text-[16px] leading-6 text-ink-1">
          {member.name}
        </Text>
        <Text numberOfLines={1} className="font-ui-md text-[12px] leading-4 text-ink-3">
          {weekLine(member)}
        </Text>
      </View>
      <WeekDots week={member.week} />
    </Press>
  );
});
