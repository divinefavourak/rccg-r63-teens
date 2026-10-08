/**
 * Bible — translations and Scripture text.
 *
 * Gated on `bible.manage`. Reading Scripture needs no permission at all — it is
 * public in the teen app — so this screen is purely the write side: which
 * translations exist and how complete each one's import is.
 *
 * Completeness is the number that matters. A translation that is present but
 * missing books is worse than one that is absent, because the reader hits a gap
 * mid-passage rather than being told up front.
 *
 * The books of each translation are counted by the backend (`count` on
 * `/bible/books/?translation=`), one small request per translation. Counting
 * the rows of the books list would count one page of 20 and call every
 * translation incomplete.
 */
import { useQueries } from '@tanstack/react-query';
import { BookMarked, Check } from 'lucide-react';
import api from '../../api/axios';
import ScreenShell from '../../components/console/ScreenShell';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  Table,
  TableSkeleton,
  Td,
  Th,
} from '../../components/console/primitives';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useConsoleList } from '../../hooks/useConsoleList';

/** `BibleTranslationSerializer`. */
interface Translation {
  id: string;
  code: string;
  name: string;
  full_name?: string;
  language_name?: string;
  is_offline_capable?: boolean;
  is_default?: boolean;
  is_active?: boolean;
}

/** The canon is fixed; anything short of this is an incomplete import. */
const CANONICAL_BOOKS = 66;

export const Bible = () => {
  const { can } = useConsoleAuth();
  const enabled = can('bible.manage');

  const translations = useConsoleList<Translation>('/bible/translations/', {
    enabled,
    params: { page_size: 200 },
    errorMessage: "We couldn't load the translations. Try again.",
  });

  const bookCounts = useQueries({
    queries: translations.items.map((t) => ({
      queryKey: ['bible-book-count', t.id],
      queryFn: async () => {
        const { data } = await api.get<{ count: number }>('/bible/books/', {
          params: { translation: t.id, page_size: 1 },
        });
        return data.count;
      },
    })),
  });

  return (
    <ScreenShell
      title="Bible"
      subtitle="Translations available to the app, and how complete each import is."
      hideScope
    >
      <Card>
        {translations.isLoading ? (
          <TableSkeleton rows={4} />
        ) : translations.error ? (
          <ErrorState message={translations.error} onRetry={translations.reload} />
        ) : translations.items.length === 0 ? (
          <EmptyState
            title="No translations imported yet"
            message="Scripture text is imported per translation. Until one is present, the Verse of the Day and every reading screen have nothing to show."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Translation</Th>
                <Th>Language</Th>
                <Th>Books</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {translations.items.map((t, i) => {
                const books = bookCounts[i];
                const count = books?.data;
                const complete = count !== undefined && count >= CANONICAL_BOOKS;
                return (
                  <tr key={t.id} className="hover:bg-console-tinted">
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pop-sky text-pop-on">
                          <BookMarked size={18} />
                        </span>
                        <div>
                          <span className="block font-semibold leading-5 text-console-text">
                            {t.full_name || t.name}
                          </span>
                          <span className="block text-[12px] font-medium leading-4 text-console-muted">
                            {t.code}
                          </span>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-console-text">{t.language_name || '—'}</Td>
                    <Td className="whitespace-nowrap tabular-nums text-console-text">
                      {books?.isPending ? (
                        <Skeleton className="h-4 w-16" />
                      ) : books?.isError ? (
                        <span className="text-console-muted">Couldn't count</span>
                      ) : (
                        <>
                          {count} <span className="text-console-muted">of {CANONICAL_BOOKS}</span>
                        </>
                      )}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {count !== undefined &&
                          (complete ? (
                            <span className="inline-flex h-[26px] items-center gap-1 rounded-full bg-pop-green pl-1.5 pr-2.5 text-[12px] font-semibold leading-4 text-pop-on">
                              <Check size={14} strokeWidth={2.5} /> Complete
                            </span>
                          ) : (
                            <Badge tone="caution">Partial import</Badge>
                          ))}
                        {t.is_default && <Badge tone="action">Default</Badge>}
                        {t.is_offline_capable && <Badge tone="info">Works offline</Badge>}
                        {t.is_active === false && <Badge>Inactive</Badge>}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <p className="mt-4 max-w-3xl text-[14px] leading-5 text-console-body">
        Importing Scripture is a management command, not a Console action. It
        writes hundreds of thousands of rows and belongs in a deploy shell where
        it can be watched. This screen reports what those imports produced.
      </p>
    </ScreenShell>
  );
};

export default Bible;
