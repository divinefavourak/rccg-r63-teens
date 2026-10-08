/**
 * Manuals — teaching material by week.
 *
 * The reading surface for everyone with `content.view`, which is every Console
 * role including Teacher. Where the Content calendar answers "what will the
 * teens read", this answers "what am I teaching".
 *
 * The list is paged and searched on the server and carries only what a row
 * shows. Opening a row fetches that one manual, which for anyone holding
 * `content.view` is the teacher edition: the lesson, plus the notes and
 * discussion guide a class never sees.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import api from '../../api/axios';
import ScreenShell from '../../components/console/ScreenShell';
import {
  Badge,
  Btn,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  Pager,
  PublishPill,
  SearchField,
  Skeleton,
  Table,
  TableSkeleton,
  Td,
  Th,
} from '../../components/console/primitives';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useConsolePage } from '../../hooks/useConsoleList';
import { useDebounced } from '../../hooks/useDebounced';
import { parseAPIDate } from '../../utils/dates';

/** `ManualListSerializer`. */
interface ManualRow {
  id: string;
  title: string;
  series_title?: string | null;
  week_number?: number | null;
  week_start_date?: string;
  theme?: string;
  target_age_group?: string;
  status: string;
}

/** `ManualTeacherDetailSerializer`, the parts read here. */
interface ManualDetail extends ManualRow {
  memory_verse?: string;
  memory_verse_text?: string;
  lesson_objectives?: string;
  lesson_content?: string;
  key_takeaways?: string;
  discussion_questions?: string;
  practical_application?: string;
  has_teacher_edition?: boolean;
  teacher_notes?: string;
  discussion_guide?: string;
}

const PAGE_SIZE = 20;

const AGE_GROUPS: Record<string, string> = {
  all: 'All ages',
  children: 'Children',
  pre_teen: 'Pre-teens',
  teen: 'Teens',
};

const weekOf = (value: string | undefined) =>
  parseAPIDate(value)?.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }) ?? '—';

/** Lesson text is stored as plain text or simple lists; shown as written. */
const Section = ({ title, body }: { title: string; body?: unknown }) => {
  const text = Array.isArray(body) ? body.join('\n') : typeof body === 'string' ? body : '';
  if (!text.trim()) return null;
  return (
    <section>
      <h3 className="mb-1 text-[12px] font-medium uppercase leading-4 tracking-[0.06em] text-console-muted">
        {title}
      </h3>
      <p className="whitespace-pre-line text-[16px] leading-6 text-console-text">{text}</p>
    </section>
  );
};

const Lesson = ({ row, onClose }: { row: ManualRow; onClose: () => void }) => {
  const detail = useQuery({
    queryKey: ['manual', row.id],
    queryFn: async () => (await api.get<ManualDetail>(`/content/manuals/${row.id}/`)).data,
  });
  const m = detail.data;
  const teacherOnly = [m?.teacher_notes, m?.discussion_guide].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0,
  );

  return (
    <Modal
      title={row.title}
      subtitle={[
        row.week_number ? `Week ${row.week_number}` : null,
        `week of ${weekOf(row.week_start_date)}`,
        row.theme,
      ]
        .filter(Boolean)
        .join(' · ')}
      onClose={onClose}
      width={720}
      footer={
        <Btn size="md" onClick={onClose}>
          Close
        </Btn>
      }
    >
      {detail.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : detail.isError || !m ? (
        <ErrorState
          message={`We couldn't open “${row.title}”. Try again.`}
          onRetry={() => detail.refetch()}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {m.memory_verse && (
            <div className="rounded-console-md bg-pop-violet px-3.5 py-3 text-pop-on">
              <p className="text-[12px] font-medium uppercase leading-4 tracking-[0.06em]">
                Memory verse
              </p>
              <p className="mt-0.5 text-[16px] font-semibold leading-6">{m.memory_verse}</p>
              {m.memory_verse_text && (
                <p className="mt-0.5 text-[14px] leading-5">{m.memory_verse_text}</p>
              )}
            </div>
          )}

          {/* Answers and notes are printed on the dark panel in both page
              modes, so they read as "not for the class". */}
          {teacherOnly.length > 0 && (
            <div className="rounded-console-md bg-console-teacher-bg px-3.5 py-3 text-console-teacher-text">
              <p className="flex items-center gap-1.5 text-[12px] font-medium uppercase leading-4 tracking-[0.06em] text-console-teacher-label">
                <Lock size={14} /> Teachers only · never shown to teens
              </p>
              {teacherOnly.map((part) => (
                <p key={part.slice(0, 40)} className="mt-2 whitespace-pre-line text-[16px] leading-6">
                  {part}
                </p>
              ))}
            </div>
          )}

          <Section title="Objectives" body={m.lesson_objectives} />
          <Section title="Lesson" body={m.lesson_content} />
          <Section title="Key takeaways" body={m.key_takeaways} />
          <Section title="Discussion questions" body={m.discussion_questions} />
          <Section title="Practical application" body={m.practical_application} />
        </div>
      )}
    </Modal>
  );
};

export const Manuals = () => {
  const { can } = useConsoleAuth();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [reading, setReading] = useState<ManualRow | null>(null);
  const search = useDebounced(query.trim());
  const canManage = can('content.manage');

  const list = useConsolePage<ManualRow>('/content/manuals/', {
    enabled: can('content.view'),
    params: {
      ordering: '-week_start_date',
      search: search || undefined,
      page,
      page_size: PAGE_SIZE,
    },
    errorMessage: "We couldn't load the manuals. Try again.",
  });

  return (
    <ScreenShell
      title="Manuals"
      subtitle={
        list.isLoading || list.error
          ? 'Weekly teaching material, newest first.'
          : `${list.count.toLocaleString()} ${list.count === 1 ? 'lesson' : 'lessons'}${
              search ? ` matching “${search}”` : ''
            }, newest first`
      }
      readOnly={can('content.view') && !canManage}
      hideScope
      actions={
        <SearchField
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          label="Search manuals"
          placeholder="Search title, theme or verse"
        />
      }
    >
      {reading && <Lesson row={reading} onClose={() => setReading(null)} />}

      <Card>
        {list.isLoading ? (
          <TableSkeleton rows={5} />
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : list.items.length === 0 ? (
          <EmptyState
            title={search ? `No manual matches “${search}”` : 'No manuals yet'}
            message={
              search
                ? 'Search covers the title, the theme and the memory verse.'
                : canManage
                  ? 'Weekly teaching material appears here once it is created.'
                  : 'Weekly teaching material appears here once it is published.'
            }
            action={
              search ? (
                <Btn size="md" onClick={() => setQuery('')}>
                  Clear search
                </Btn>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Week</Th>
                  <Th>Lesson</Th>
                  <Th>Series</Th>
                  <Th>For</Th>
                  {/* Only someone who manages content is ever sent an
                      unpublished manual, so only they need the column. */}
                  {canManage && <Th>Status</Th>}
                </tr>
              </thead>
              <tbody className={list.isFetching ? 'opacity-60' : ''}>
                {list.items.map((m) => (
                  <tr key={m.id} className="hover:bg-console-tinted">
                    <Td className="whitespace-nowrap">
                      <span className="block font-semibold leading-5 text-console-text">
                        {m.week_number ? `Week ${m.week_number}` : '—'}
                      </span>
                      <span className="block text-[12px] font-medium leading-4 text-console-muted">
                        {weekOf(m.week_start_date)}
                      </span>
                    </Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => setReading(m)}
                        className="block w-full rounded-console-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-console-text"
                      >
                        <span className="block font-semibold leading-5 text-console-text underline-offset-2 hover:underline">
                          {m.title}
                        </span>
                        {m.theme && (
                          <span className="block text-[12px] font-medium leading-4 text-console-muted">
                            {m.theme}
                          </span>
                        )}
                      </button>
                    </Td>
                    <Td className="text-console-body">{m.series_title || '—'}</Td>
                    <Td>
                      <Badge>{AGE_GROUPS[m.target_age_group ?? 'all'] ?? m.target_age_group}</Badge>
                    </Td>
                    {canManage && (
                      <Td>
                        <PublishPill status={m.status} />
                      </Td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
            {list.count > PAGE_SIZE && (
              <Pager
                page={page}
                pageSize={PAGE_SIZE}
                count={list.count}
                shown={list.items.length}
                noun="lessons"
                onPage={setPage}
              />
            )}
          </>
        )}
      </Card>
    </ScreenShell>
  );
};

export default Manuals;
