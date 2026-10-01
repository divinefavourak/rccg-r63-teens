/**
 * Manuals — teaching material by week.
 *
 * The reading surface for everyone with `content.view`, which is every Console
 * role including Teacher. Where the Content calendar answers "what will the
 * teens read", this answers "what am I teaching".
 */
import { useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import ScreenShell from '../../components/console/ScreenShell';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Table,
  TableSkeleton,
  Td,
  Th,
} from '../../components/console/primitives';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useConsoleList } from '../../hooks/useConsoleList';

interface Manual {
  id: string;
  title: string;
  week_number?: number | string;
  week_start_date?: string;
  week_end_date?: string;
  theme?: string;
  memory_verse?: string;
  status?: string;
  target_age_group?: string;
  has_teacher_edition?: boolean;
}

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'action' | 'success'> = {
  draft: 'neutral',
  in_review: 'info',
  approved: 'action',
  scheduled: 'action',
  published: 'success',
  archived: 'neutral',
};

export const Manuals = () => {
  const { can } = useConsoleAuth();
  const [query, setQuery] = useState('');

  const { items, isLoading, error, reload } = useConsoleList<Manual>(
    '/content/manuals/',
    {
      enabled: can('content.view'),
      params: { ordering: '-week_start_date' },
      errorMessage: 'Could not load the manuals.',
    },
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (m) =>
        m.title?.toLowerCase().includes(q) ||
        m.theme?.toLowerCase().includes(q) ||
        m.memory_verse?.toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <ScreenShell
      title="Manuals"
      subtitle="Weekly teaching material, newest first."
      readOnly={can('content.view') && !can('content.manage')}
      actions={
        <div className="flex items-center gap-2 rounded-console-md border border-console-border bg-console-surface px-2.5 py-1.5">
          <Search size={14} className="shrink-0 text-console-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, theme, verse…"
            className="w-52 bg-transparent text-[13px] text-console-text outline-none placeholder:text-console-subtle"
          />
        </div>
      }
    >
      <Card>
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={query ? 'No matches' : 'No manuals yet'}
            message={
              query
                ? `Nothing matches “${query}”.`
                : 'Weekly teaching material appears here once it is created.'
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Week</Th>
                <Th>Title & theme</Th>
                <Th>Memory verse</Th>
                <Th>Age group</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-console-tinted">
                  <Td className="whitespace-nowrap">
                    <span className="font-medium text-console-text">
                      {m.week_number ? `Week ${m.week_number}` : '—'}
                    </span>
                    <span className="block text-[11px] text-console-subtle">
                      {formatDate(m.week_start_date)}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-medium text-console-text">
                      {m.title}
                    </span>
                    {m.theme && (
                      <span className="block text-[11px] text-console-subtle">
                        {m.theme}
                      </span>
                    )}
                  </Td>
                  <Td className="text-[12px] text-console-muted">
                    {m.memory_verse || '—'}
                  </Td>
                  <Td className="text-[12px] text-console-muted">
                    {m.target_age_group || 'All'}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      {m.status && (
                        <Badge tone={STATUS_TONE[m.status] ?? 'neutral'}>
                          {m.status.replace('_', ' ')}
                        </Badge>
                      )}
                      {/* Teacher-edition content is answers and notes — never
                          shown to a class, so it is flagged, not inlined. */}
                      {m.has_teacher_edition && (
                        <Badge tone="neutral" title="Includes teacher-only notes">
                          <BookOpen size={11} /> Teacher ed.
                        </Badge>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </ScreenShell>
  );
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default Manuals;
