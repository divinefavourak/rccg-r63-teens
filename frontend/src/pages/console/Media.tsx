/**
 * Library & Media — podcasts, videos and playlists.
 *
 * Gated on `media.manage`, the only media permission in the registry: *reading*
 * media needs none, because it is public in the teen app. This screen exists to
 * manage it.
 *
 * A grid of thumbnails rather than a table, because the thing that identifies an
 * episode to the person who uploaded it is the artwork, not the title in a
 * column. Selecting one opens it inline — you should be able to confirm the
 * right file went up without leaving the page.
 */
import { useMemo, useState } from 'react';
import {
  Clock,
  Film,
  Headphones,
  Layers,
  Play,
  Upload,
  X,
} from 'lucide-react';
import ScreenShell from '../../components/console/ScreenShell';
import {
  Btn,
  Card,
  EmptyState,
  ErrorState,
  Pager,
  PublishPill,
  Skeleton,
  Table,
  TableSkeleton,
  Tabs,
  Td,
  Th,
} from '../../components/console/primitives';
import { PermissionGate } from '../../components/console/PermissionGate';
import MediaUploader from '../../components/console/MediaUploader';
import { useConsoleAuth } from '../../context/ConsoleAuthContext';
import { useConsoleList, useConsolePage } from '../../hooks/useConsoleList';

interface Episode {
  id: string;
  title: string;
  description?: string;
  media_type?: string;
  thumbnail?: string | null;
  audio_file?: string | null;
  audio_url?: string | null;
  video_file?: string | null;
  video_url?: string | null;
  duration_seconds?: number | null;
  duration_formatted?: string | null;
  status?: string;
  published_at?: string | null;
  series?: string | null;
  series_title?: string | null;
  view_count?: number;
  episode_number?: number | null;
}

interface Series {
  id: string;
  title: string;
  short_description?: string;
  cover_image?: string | null;
  episode_count?: number;
  status?: string;
}

type Tab = 'episodes' | 'series';

const PAGE_SIZE = 18;

/** The playable URL, whichever field it landed in. */
function sourceOf(e: Episode): string | null {
  return (
    e.video_file || e.video_url || e.audio_file || e.audio_url || null
  );
}

const isVideo = (e: Episode) =>
  e.media_type === 'video' || Boolean(e.video_file || e.video_url);

export const Media = () => {
  const { can } = useConsoleAuth();
  const [tab, setTab] = useState<Tab>('episodes');
  const [uploading, setUploading] = useState(false);
  const [playing, setPlaying] = useState<Episode | null>(null);
  const enabled = can('media.manage');

  const [episodePage, setEpisodePage] = useState(1);
  const [seriesPage, setSeriesPage] = useState(1);

  // Newest upload first. The endpoint's own default orders by publish date,
  // which leaves drafts (no publish date) in no useful order.
  const episodes = useConsolePage<Episode>('/media/episodes/', {
    enabled,
    params: { ordering: '-created_at', page: episodePage, page_size: PAGE_SIZE },
    errorMessage: "We couldn't load the episodes. Try again.",
  });
  const series = useConsolePage<Series>('/media/series/', {
    enabled,
    params: { page: seriesPage, page_size: PAGE_SIZE },
    errorMessage: "We couldn't load the series. Try again.",
  });

  // Every series, for the uploader's picker: a page of 18 would hide the rest.
  const allSeries = useConsoleList<Series>('/media/series/', {
    enabled,
    params: { page_size: 200, ordering: '-created_at' },
  });
  const seriesOptions = useMemo(
    () => allSeries.items.map((s) => ({ id: s.id, title: s.title })),
    [allSeries.items],
  );

  return (
    <ScreenShell
      title="Library & Media"
      subtitle="Podcasts, videos and the series they belong to."
      hideScope
      actions={
        <PermissionGate permission="media.manage">
          <Btn variant="primary" size="md" onClick={() => setUploading(true)}>
            <Upload size={16} /> Upload
          </Btn>
        </PermissionGate>
      }
    >
      {uploading && (
        <MediaUploader
          series={seriesOptions}
          onClose={() => setUploading(false)}
          onUploaded={() => {
            setUploading(false);
            episodes.reload();
          }}
        />
      )}

      <Tabs
        tabs={[
          { id: 'episodes', label: 'Episodes', count: episodes.isLoading ? undefined : episodes.count },
          { id: 'series', label: 'Series', count: series.isLoading ? undefined : series.count },
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* Inline player. Sits above the grid rather than in a modal so you can
          keep scanning the library while something plays. */}
      {playing && (
        <Card className="mb-4 overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-console-border px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-console-text">
                {playing.title}
              </p>
              {playing.series_title && (
                <p className="text-[12px] font-medium text-console-muted">
                  {playing.series_title}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPlaying(null)}
              aria-label="Close player"
              className="rounded-console-sm p-1 text-console-muted hover:bg-console-tinted"
            >
              <X size={16} />
            </button>
          </div>

          <div className="bg-black p-3">
            {sourceOf(playing) ? (
              isVideo(playing) ? (
                <video
                  key={playing.id}
                  src={sourceOf(playing)!}
                  poster={playing.thumbnail ?? undefined}
                  controls
                  className="mx-auto max-h-[420px] w-full rounded-console-md"
                />
              ) : (
                <audio
                  key={playing.id}
                  src={sourceOf(playing)!}
                  controls
                  className="w-full"
                />
              )
            ) : (
              <p className="py-6 text-center text-[14px] text-console-subtle">
                This episode has no file or URL attached, so there is nothing to
                play.
              </p>
            )}
          </div>
        </Card>
      )}

      {tab === 'episodes' ? (
        episodes.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        ) : episodes.error ? (
          <Card>
            <ErrorState message={episodes.error} onRetry={episodes.reload} />
          </Card>
        ) : episodes.items.length === 0 ? (
          <Card>
            <EmptyState
              title="Nothing uploaded yet"
              message="Podcasts and videos you upload appear here, and in the teen app once published."
              action={
                <PermissionGate permission="media.manage">
                  <Btn variant="primary" size="md" onClick={() => setUploading(true)}>
                    <Upload size={16} /> Upload the first one
                  </Btn>
                </PermissionGate>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {episodes.items.map((e) => {
              const playable = Boolean(sourceOf(e));
              return (
                <Card key={e.id} className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => playable && setPlaying(e)}
                    disabled={!playable}
                    className="group relative block aspect-video w-full overflow-hidden bg-console-tinted disabled:cursor-default"
                  >
                    {e.thumbnail ? (
                      <img
                        src={e.thumbnail}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      // No artwork is normal, not an error — show the medium.
                      <span className="flex h-full w-full items-center justify-center">
                        {isVideo(e) ? (
                          <Film size={26} className="text-console-subtle" />
                        ) : (
                          <Headphones size={26} className="text-console-subtle" />
                        )}
                      </span>
                    )}

                    {playable && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/35">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 opacity-0 transition-opacity group-hover:opacity-100">
                          <Play size={17} className="ml-0.5 text-stone-900" />
                        </span>
                      </span>
                    )}

                    {e.duration_formatted && (
                      <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[12px] font-medium tabular-nums text-white">
                        {e.duration_formatted}
                      </span>
                    )}
                  </button>

                  <div className="p-4">
                    <p className="line-clamp-2 text-[14px] font-semibold leading-5 text-console-text">
                      {e.title}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <PublishPill status={e.status ?? 'draft'} />
                      {e.series_title && (
                        <span className="truncate text-[12px] font-medium text-console-muted">
                          {e.series_title}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-[12px] font-medium text-console-muted">
                      <span className="flex items-center gap-1">
                        <Play size={12} /> {e.view_count ?? 0}
                      </span>
                      {e.duration_seconds ? (
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {e.duration_formatted ??
                            `${Math.round(e.duration_seconds / 60)} min`}
                        </span>
                      ) : null}
                    </div>
                    {!playable && (
                      <p className="mt-1.5 text-[12px] text-console-caution">
                        No file attached
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
            {episodes.count > PAGE_SIZE && (
              <Card className="sm:col-span-2 lg:col-span-3">
                <div className="[&>div]:border-t-0">
                  <Pager
                    page={episodePage}
                    pageSize={PAGE_SIZE}
                    count={episodes.count}
                    shown={episodes.items.length}
                    noun="episodes"
                    onPage={setEpisodePage}
                  />
                </div>
              </Card>
            )}
          </div>
        )
      ) : (
        <Card>
          {series.isLoading ? (
            <TableSkeleton rows={4} />
          ) : series.error ? (
            <ErrorState message={series.error} onRetry={series.reload} />
          ) : series.items.length === 0 ? (
            <EmptyState
              title="No series"
              message="Series group episodes together — a teaching run, a podcast season."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Series</Th>
                  <Th>Episodes</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {series.items.map((s) => (
                  <tr key={s.id} className="hover:bg-console-tinted">
                    <Td>
                      <div className="flex items-center gap-3">
                        {s.cover_image ? (
                          <img
                            src={s.cover_image}
                            alt=""
                            loading="lazy"
                            className="h-10 w-10 shrink-0 rounded-console-sm object-cover"
                          />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-console-sm bg-console-tinted">
                            <Layers size={15} className="text-console-subtle" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <span className="block font-medium text-console-text">
                            {s.title}
                          </span>
                          {s.short_description && (
                            <span className="line-clamp-1 text-[12px] font-medium text-console-muted">
                              {s.short_description}
                            </span>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td className="tabular-nums text-console-body">
                      {s.episode_count ?? 0}
                    </Td>
                    <Td>
                      <PublishPill status={s.status ?? 'draft'} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {series.count > PAGE_SIZE && (
            <Pager
              page={seriesPage}
              pageSize={PAGE_SIZE}
              count={series.count}
              shown={series.items.length}
              noun="series"
              onPage={setSeriesPage}
            />
          )}
        </Card>
      )}
    </ScreenShell>
  );
};

export default Media;
