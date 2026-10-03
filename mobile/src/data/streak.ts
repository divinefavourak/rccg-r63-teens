import type { StreakState } from '../api/types';
import type { WeekDayState } from '../ui/cards';

/**
 * Turning a streak into days on a calendar.
 *
 * The API gives a run's length and its last active day, not a list of dates,
 * so the run is the `current_length` days ending on `last_active_on`. There is
 * no "missed" state anywhere here, on purpose (12-gamification.md: never shame
 * a gap) — a past day outside the run looks the same as a day still to come.
 */

export const DAY_MS = 86_400_000;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Was `daysAgo` (0 = today) part of the current run? */
export function inRun(streak: StreakState | null, daysAgo: number): boolean {
  if (!streak?.last_active_on || streak.current_length <= 0) return false;
  const last = startOfDay(new Date(`${streak.last_active_on}T00:00:00`));
  const sinceLast = Math.round((startOfDay(new Date()).getTime() - last.getTime()) / DAY_MS);
  return daysAgo >= sinceLast && daysAgo < sinceLast + streak.current_length;
}

/** Has the teen already done something today? */
export function activeToday(streak: StreakState | null): boolean {
  return inRun(streak, 0);
}

const WEEK_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** This week, Monday first, for the streak card. `done` is today's state. */
export function streakWeek(
  streak: StreakState,
  done: boolean,
): { letter: string; state: WeekDayState }[] {
  // JS weeks start on Sunday; this row starts on Monday.
  const todayIndex = (new Date().getDay() + 6) % 7;
  return WEEK_LETTERS.map((letter, i) => {
    const daysAgo = todayIndex - i;
    const state: WeekDayState =
      daysAgo === 0 ? (done ? 'done' : 'today') : daysAgo > 0 && inRun(streak, daysAgo) ? 'done' : 'next';
    return { letter, state };
  });
}

/** The two lines of the streak card. Encouraging whatever the number is. */
export function streakWords(streak: StreakState, done: boolean): { title: string; message: string } {
  const length = streak.current_length;
  return {
    title: length > 0 ? `${length}-day streak` : 'Start your streak',
    message: done
      ? 'You showed up today. See you tomorrow.'
      : length > 0
        ? 'Today’s reading keeps it going.'
        : 'Read today and this becomes day one.',
  };
}
