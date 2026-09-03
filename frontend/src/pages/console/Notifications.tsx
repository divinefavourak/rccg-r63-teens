/**
 * Notifications.
 *
 * **This screen has no backend.** `notifications/urls.py` exposes exactly three
 * routes — `inbox/`, `preferences/`, `push/` — and its own docstring says
 * "every route is owner-scoped". There is no endpoint to send an announcement,
 * read ladder health, or view delivery statistics.
 *
 * So rather than a dashboard of invented numbers, this states what the product
 * has decided about notifications and what would have to exist to manage them.
 * A fabricated chart here would be worse than an empty screen: someone would
 * make a decision from it.
 *
 * The design rules below are not placeholders — they are constraints from
 * `notifications/models.py` that any future admin surface must not violate.
 */
import { Bell, Lock } from 'lucide-react';
import ScreenShell from '../../components/console/ScreenShell';
import { Card, CardHeader } from '../../components/console/primitives';

const RUNGS = [
  { label: 'Morning', time: '06:30' },
  { label: 'Afternoon', time: '13:30' },
  { label: 'Evening', time: '18:30' },
  { label: 'Final', time: '20:45' },
];

const RULES = [
  'Reminders stop the moment the teen completes the day.',
  'Intensity steps *down* automatically after 7 ignored days — never up.',
  'Gentle is the floor. It never steps down into silence.',
  'Quiet hours run 21:30–06:00 and nothing is delivered inside them.',
  'No control anywhere may raise a teen’s reminder intensity for them. Only the teen raises it.',
];

export const Notifications = () => (
  <ScreenShell
    title="Notifications"
    subtitle="How the daily habit ladder behaves — and why there is nothing to configure here yet."
    hideScope
  >
    <div className="mb-4 flex items-start gap-3 rounded-console-lg border border-console-border bg-console-info-bg p-4">
      <Lock size={17} className="mt-0.5 shrink-0 text-console-info" />
      <div>
        <p className="text-[13px] font-semibold text-console-info">
          No management API exists for this yet
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-console-body">
          Every notifications route is owner-scoped — a teen reads their own
          inbox and sets their own preferences. Sending an announcement, reading
          delivery stats and viewing ladder health would each need an endpoint
          that has not been built. This screen deliberately shows no numbers
          rather than invented ones.
        </p>
      </div>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <span className="flex items-center gap-2 text-[13px] font-semibold text-console-text">
            <Bell size={15} className="text-console-subtle" />
            The four rungs
          </span>
        </CardHeader>
        <ul className="divide-y divide-console-border">
          {RUNGS.map((r, i) => (
            <li
              key={r.label}
              className="flex items-center justify-between px-4 py-2.5"
            >
              <span className="text-[13px] text-console-body">
                <span className="mr-2 text-[11px] tabular-nums text-console-subtle">
                  {i + 1}
                </span>
                {r.label}
              </span>
              <span className="font-mono text-[12px] tabular-nums text-console-muted">
                {r.time}
              </span>
            </li>
          ))}
        </ul>
        <p className="px-4 py-3 text-[11px] leading-relaxed text-console-subtle">
          Gentle uses rung 1. Standard uses 1 and 3. Committed uses all four.
        </p>
      </Card>

      <Card>
        <CardHeader>
          <span className="text-[13px] font-semibold text-console-text">
            Rules that must hold
          </span>
        </CardHeader>
        <ul className="space-y-2 p-4">
          {RULES.map((rule) => (
            <li
              key={rule}
              className="text-[13px] leading-relaxed text-console-body"
            >
              — {rule}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  </ScreenShell>
);

export default Notifications;
