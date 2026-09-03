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
 */
import { useMemo } from 'react';
import { BookMarked } from 'lucide-react';
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

interface Translation {
  id: string;
  name?: string;
  abbreviation?: string;
  language?: string;
  is_default?: boolean;
  is_active?: boolean;
  book_count?: number;
  verse_count?: number;
}

interface Book {
  id: string;
  name?: string;
  testament?: string;
  chapter_count?: number;
  translation?: string;
}

/** The canon is fixed; anything short of this is an incomplete import. */
const CANONICAL_BOOKS = 66;

export const Bible = () => {
  const { can } = useConsoleAuth();
  const enabled = can('bible.manage');

  const translations = useConsoleList<Translation>('/bible/translations/', {
    enabled,
    errorMessage: 'Could not load translations.',
  });
  const books = useConsoleList<Book>('/bible/books/', {
    enabled,
    errorMessage: 'Could not load books.',
  });

  /** Books grouped per translation, so completeness is computed not trusted. */
  const booksPerTranslation = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of books.items) {
      if (!b.translation) continue;
      map.set(b.translation, (map.get(b.translation) ?? 0) + 1);
    }
    return map;
  }, [books.items]);

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
          <ErrorState
            message={translations.error}
            onRetry={translations.reload}
          />
        ) : translations.items.length === 0 ? (
          <EmptyState
            title="No translations imported"
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
              {translations.items.map((t) => {
                const count = t.book_count ?? booksPerTranslation.get(t.id) ?? 0;
                const complete = count >= CANONICAL_BOOKS;
                return (
                  <tr key={t.id} className="hover:bg-console-tinted">
                    <Td>
                      <div className="flex items-center gap-2">
                        <BookMarked
                          size={15}
                          className="shrink-0 text-console-subtle"
                        />
                        <div>
                          <span className="font-medium text-console-text">
                            {t.name ?? t.abbreviation ?? 'Unnamed'}
                          </span>
                          {t.abbreviation && t.name && (
                            <span className="ml-1.5 text-[11px] text-console-subtle">
                              {t.abbreviation}
                            </span>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td className="text-[12px] text-console-muted">
                      {t.language ?? '—'}
                    </Td>
                    <Td className="tabular-nums text-console-body">
                      {count}
                      <span className="text-console-subtle">
                        {' '}
                        / {CANONICAL_BOOKS}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {t.is_default && <Badge tone="action">Default</Badge>}
                        <Badge tone={complete ? 'success' : 'caution'}>
                          {complete ? 'Complete' : 'Partial import'}
                        </Badge>
                        {t.is_active === false && (
                          <Badge tone="neutral">Inactive</Badge>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <p className="mt-3 text-[12px] leading-relaxed text-console-muted">
        Importing Scripture is a management command, not a Console action — it
        writes hundreds of thousands of rows and belongs in a deploy shell where
        it can be watched. This screen reports what those imports produced.
      </p>
    </ScreenShell>
  );
};

export default Bible;
