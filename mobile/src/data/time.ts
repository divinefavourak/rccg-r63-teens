import { timeLabel } from './events';

const DAY_MS = 86_400_000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * How long ago something happened, in the calendar's words rather than a
 * count: "Today", "Yesterday", "Mon", then "24 Sept".
 */
export function dayAgo(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';

  const days = Math.round((startOfDay(new Date()) - startOfDay(then)) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return then.toLocaleDateString('en-GB', { weekday: 'short' });
  return `${then.getDate()} ${then.toLocaleDateString('en-GB', { month: 'short' })}`;
}

/** As `dayAgo`, but with the time for anything from today: "6:30 am". */
export function whenAgo(iso: string): string {
  const label = dayAgo(iso);
  return label === 'Today' ? timeLabel(new Date(iso)) : label;
}
