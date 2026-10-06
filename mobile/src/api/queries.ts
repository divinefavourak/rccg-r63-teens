import { Platform } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';

import { api, ApiError, fetchAllPages } from './client';
import { STALE } from './config';
import { readChapter, readList, writeChapter, writeList } from '../data/bibleStore';
import type {
  AppNotification,
  CheckInAttendee,
  CheckInEvent,
  CheckInResult,
  ClassMemberDetail,
  ClassRoster,
  ManualDetail,
  ArticleDetail,
  ArticleListItem,
  Bookmark,
  MediaEpisode,
  ProgressCalendar,
  ScriptureSearch,
  EventRegistration,
  EventRegistrationDetail,
  EventRegistrationInput,
  Favorite,
  TeenProfile,
  Identity,
  NotificationPreferences,
  BibleBook,
  ChurchLevel,
  ChurchNode,
  BibleTranslation,
  ScriptureLookup,
  DevotionalDetail,
  DevotionalListItem,
  EventDetail,
  EventListItem,
  Paginated,
  ProgressSummary,
  TodayResponse,
} from './types';

/**
 * React Query hooks, one per screen concern.
 *
 * Keys are arrays so a mutation can invalidate a whole family — completing the
 * daily challenge invalidates `today` and `progress` together, because both
 * render the streak.
 */

export const keys = {
  today: ['today'] as const,
  devotional: (id: string) => ['devotional', id] as const,
  devotionals: (params?: string) => ['devotionals', params ?? ''] as const,
  progress: ['progress'] as const,
  events: ['events'] as const,
  event: (id: string) => ['event', id] as const,
  notifications: ['notifications'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  identity: ['identity'] as const,
  profile: ['profile'] as const,
  drafts: ['devotionals', 'drafts'] as const,
  notificationPrefs: ['notifications', 'preferences'] as const,
  favorites: ['favorites'] as const,
  myRegistrations: ['registrations', 'mine'] as const,
  church: (parent: string | null, level: string, search: string) =>
    ['church', parent ?? 'root', level, search] as const,
  translations: ['bible', 'translations'] as const,
  books: ['bible', 'books'] as const,
  chapter: (id: string) => ['bible', 'chapter', id] as const,
  passage: (book: string, chapter: number, translation?: string) =>
    ['bible', 'passage', book, chapter, translation ?? 'default'] as const,
  reference: (text: string) => ['bible', 'reference', text] as const,
  scriptureSearch: (text: string, translation?: string) =>
    ['bible', 'search', text, translation ?? 'default'] as const,
  bookmarks: ['bible', 'bookmarks'] as const,
  articles: (params?: string) => ['articles', params ?? ''] as const,
  article: (id: string) => ['article', id] as const,
  episodes: (params?: string) => ['episodes', params ?? ''] as const,
  episode: (id: string) => ['episode', id] as const,
  calendar: (month: string) => ['progress', 'calendar', month] as const,
  lesson: ['console', 'lesson'] as const,
  classRoster: ['console', 'class'] as const,
  classMember: (id: string) => ['console', 'class', id] as const,
  checkInToday: ['console', 'check-in', 'today'] as const,
  checkInSearch: (event: string, text: string) =>
    ['console', 'check-in', 'search', event, text] as const,
};

/** DRF paginates some viewsets and not others. Accept either shape. */
function unwrap<T>(payload: Paginated<T> | T[]): T[] {
  return Array.isArray(payload) ? payload : payload.results;
}

/**
 * Retry network blips and 5xx, never 4xx.
 *
 * Retrying a 401 or a 404 burns a teen's data allowance on a request that
 * cannot succeed (15-technical-architecture.md performance budgets).
 */
export function retryTransient(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && !error.isTransient) return false;
  return failureCount < 3;
}

// ─── Today ─────────────────────────────────────────────────────────────────

/**
 * The whole Today screen in one request.
 *
 * Public — a signed-out teen gets the devotional and verse with the personal
 * half null, which is what lets Today render before anyone has an account
 * (05-navigation.md: the guest view is a preview of the real product).
 */
export function useToday() {
  return useQuery({
    queryKey: keys.today,
    queryFn: () => api.get<TodayResponse>('/today/'),
    staleTime: STALE.today,
    retry: retryTransient,
  });
}

export function useCompleteChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ challenge: string; completed: boolean; already_completed: boolean }>(
        '/today/challenge/complete/',
      ),
    onSuccess: () => {
      // Both surfaces show challenge state and streak.
      qc.invalidateQueries({ queryKey: keys.today });
      qc.invalidateQueries({ queryKey: keys.progress });
    },
  });
}

/**
 * Mark a devotional as read.
 *
 * Idempotent on the server (a read log dedupes it), so a double tap or a retry
 * on a flaky connection cannot count twice. Today and Progress both show the
 * streak this moves.
 */
export function useMarkDevotionalRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post('/content/devotionals/' + id + '/mark_read/'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.today });
      qc.invalidateQueries({ queryKey: keys.progress });
    },
  });
}

// ─── Content ───────────────────────────────────────────────────────────────

export function useDevotional(id: string | undefined) {
  return useQuery({
    queryKey: keys.devotional(id ?? ''),
    queryFn: () => api.get<DevotionalDetail>('/content/devotionals/' + id + '/'),
    enabled: !!id,
    staleTime: STALE.catalogue,
    retry: retryTransient,
  });
}

/**
 * The Library shelf.
 *
 * `status=published` is pinned deliberately. The viewset widens the queryset for
 * anyone who can manage content — so a teen leader signed into the app was
 * seeing their own unpublished drafts in Library while `/today/`, which only
 * ever serves published content, correctly showed none. Drafts belong in the
 * Console, not in the teen surface, whoever is holding the phone.
 */
export function useDevotionals(search?: string) {
  const params = new URLSearchParams({ status: 'published' });
  if (search) params.set('search', search);

  return useQuery({
    queryKey: keys.devotionals(search),
    queryFn: async () =>
      unwrap(
        await api.get<Paginated<DevotionalListItem>>(
          '/content/devotionals/?' + params.toString(),
        ),
      ),
    staleTime: STALE.catalogue,
    retry: retryTransient,
  });
}

// ─── Progress ──────────────────────────────────────────────────────────────

export function useProgress(enabled = true) {
  return useQuery({
    queryKey: keys.progress,
    queryFn: () => api.get<ProgressSummary>('/progress/summary/'),
    enabled,
    staleTime: STALE.mine,
    retry: retryTransient,
  });
}

// ─── Events ────────────────────────────────────────────────────────────────

export function useEvents() {
  return useQuery({
    queryKey: keys.events,
    // The router registers `events` inside the `/events/` include, so the path
    // really is doubled. Confirmed against backend/events/urls.py.
    queryFn: async () => unwrap(await api.get<Paginated<EventListItem>>('/events/events/')),
    staleTime: STALE.catalogue,
    retry: retryTransient,
  });
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: keys.event(id ?? ''),
    queryFn: () => api.get<EventDetail>('/events/events/' + id + '/'),
    enabled: !!id,
    staleTime: STALE.catalogue,
    retry: retryTransient,
  });
}

/**
 * Register for an event.
 *
 * The endpoint requires eleven attendee and guardian fields, so this takes a
 * full payload rather than firing on a bare tap — posting `{}` is what produced
 * the "field required" 400.
 */
export function useRegisterForEvent(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EventRegistrationInput) =>
      api.post<EventRegistrationDetail>('/events/events/' + id + '/register/', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.events });
      qc.invalidateQueries({ queryKey: keys.myRegistrations });
      if (id) qc.invalidateQueries({ queryKey: keys.event(id) });
    },
  });
}

// ─── Notifications ─────────────────────────────────────────────────────────

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: keys.notifications,
    queryFn: async () =>
      unwrap(await api.get<Paginated<AppNotification>>('/notifications/inbox/')),
    enabled,
    staleTime: STALE.inbox,
    retry: retryTransient,
  });
}

export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: keys.unreadCount,
    queryFn: () => api.get<{ unread_count: number }>('/notifications/inbox/unread_count/'),
    enabled,
    staleTime: STALE.inbox,
    retry: retryTransient,
  });
}

/**
 * Mark notifications read. Omitting `ids` marks all of them.
 *
 * Optimistic: the row should grey out the instant it is tapped. On failure the
 * previous list is restored — a notification wrongly showing as unread is a far
 * gentler failure than a row that silently does nothing.
 */
export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) =>
      api.post<{ marked_read: number; unread_count: number }>(
        '/notifications/inbox/mark_read/',
        ids ? { ids } : {},
      ),
    onMutate: async (ids?: string[]) => {
      await qc.cancelQueries({ queryKey: keys.notifications });
      const previous = qc.getQueryData<AppNotification[]>(keys.notifications);
      qc.setQueryData<AppNotification[]>(keys.notifications, (old) =>
        old?.map((n) => (!ids || ids.includes(n.id) ? { ...n, is_read: true } : n)),
      );
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) qc.setQueryData(keys.notifications, context.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.notifications });
      qc.invalidateQueries({ queryKey: keys.unreadCount });
    },
  });
}

// ─── Profile & saved items ─────────────────────────────────────────────────

export function useProfile(enabled = true) {
  return useQuery({
    queryKey: keys.profile,
    queryFn: () => api.get<TeenProfile>('/profiles/me/'),
    enabled,
    staleTime: STALE.mine,
    retry: retryTransient,
  });
}

export function useFavorites(enabled = true) {
  return useQuery({
    queryKey: keys.favorites,
    queryFn: async () => unwrap(await api.get<Paginated<Favorite>>('/profiles/favorites/')),
    enabled,
    staleTime: STALE.mine,
    retry: retryTransient,
  });
}

/**
 * Save or unsave a piece of content.
 *
 * The backend models this generically — `content_type` names the domain and
 * `content_id` the row — so one hook serves devotionals, events and articles.
 * Optimistic, because a bookmark tap must feel instantaneous even on a slow
 * connection; the list is refetched on settle either way.
 */
export function useToggleFavorite() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { contentType: string; contentId: string; saved: boolean }) => {
      if (input.saved) {
        // Custom action rather than DELETE /favorites/{id}/, so the caller
        // never needs to know the favourite row's own id.
        return api.delete('/profiles/favorites/remove/', {
          body: { content_type: input.contentType, content_id: input.contentId },
        });
      }
      return api.post<Favorite>('/profiles/favorites/', {
        content_type: input.contentType,
        content_id: input.contentId,
      });
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: keys.favorites });
      const previous = qc.getQueryData<Favorite[]>(keys.favorites);

      qc.setQueryData<Favorite[]>(keys.favorites, (old = []) =>
        input.saved
          ? old.filter((f) => f.content_id !== input.contentId)
          : [
              ...old,
              {
                id: `optimistic-${input.contentId}`,
                profile: '',
                content_type: input.contentType,
                content_id: input.contentId,
                created_at: new Date().toISOString(),
              },
            ],
      );
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) qc.setQueryData(keys.favorites, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.favorites }),
  });
}

/** The teen's own registrations, for My Tickets. */
export function useMyRegistrations(enabled = true) {
  return useQuery({
    queryKey: keys.myRegistrations,
    queryFn: async () =>
      unwrap(await api.get<Paginated<EventRegistration>>('/events/registrations/mine/')),
    enabled,
    staleTime: STALE.inbox,
    retry: retryTransient,
  });
}

// ─── Bible ─────────────────────────────────────────────────────────────────

export function useTranslations() {
  return useQuery({
    queryKey: keys.translations,
    // The server first, because a translation can be added; the phone's copy
    // when the server cannot be reached, so the picker still opens offline.
    queryFn: async () => {
      try {
        const rows = unwrap(await api.get<Paginated<BibleTranslation>>('/bible/translations/'));
        writeList('translations', rows);
        return rows;
      } catch (err) {
        const saved = await readList<BibleTranslation[]>('translations');
        if (saved) return saved;
        throw err;
      }
    },
    staleTime: STALE.scripture,
    gcTime: STALE.scripture,
    // Runs with no signal too: it has somewhere to look besides the network.
    networkMode: 'always',
    retry: retryTransient,
  });
}

/**
 * Every book of the Bible, once.
 *
 * Two things the raw endpoint gets wrong for a picker:
 *
 * 1. It is paginated at 20 rows and ignores `page_size`, so a single request
 *    returned Genesis-to-Numbers and nothing else — John was never in the list.
 * 2. Books are stored per translation, so 66 books across two translations is
 *    132 rows and every name appears twice.
 *
 * So: fetch all pages, then collapse to one row per `osis_code`, in canonical
 * order. `chapter_count` comes along to bound chapter navigation.
 */
export function useBooks() {
  return useQuery({
    queryKey: keys.books,
    queryFn: async () => {
      // The 66 books do not change. Once this phone has the list, it is never
      // asked for again: that was four or more requests on every cold start.
      const saved = await readList<BibleBook[]>('books');
      if (saved?.length) return saved;

      const rows = await fetchAllPages<BibleBook>('/bible/books/');

      const byOsis = new Map<string, BibleBook>();
      for (const book of rows) {
        if (!byOsis.has(book.osis_code)) byOsis.set(book.osis_code, book);
      }

      const books = [...byOsis.values()].sort((a, b) => a.book_number - b.book_number);
      if (books.length) writeList('books', books);
      return books;
    },
    staleTime: STALE.scripture,
    gcTime: STALE.scripture,
    // Runs with no signal too: it has somewhere to look besides the network.
    networkMode: 'always',
    retry: retryTransient,
  });
}

/**
 * Saved-state for one content domain, as the screens actually need it.
 *
 * Wraps the favourites list and the toggle into a membership test, so a card
 * asks "is this saved?" rather than searching a list itself. Disabled for
 * guests — the endpoint is authenticated, and a signed-out teen has no saved
 * items to show.
 */
export function useSaved(contentType: string, enabled = true) {
  const favorites = useFavorites(enabled);
  const toggle = useToggleFavorite();

  const ids = new Set(
    (favorites.data ?? [])
      .filter((f) => f.content_type === contentType)
      .map((f) => f.content_id),
  );

  return {
    isSaved: (id: string) => ids.has(id),
    count: ids.size,
    toggle: (id: string) => toggle.mutate({ contentType, contentId: id, saved: ids.has(id) }),
    /** True while the list is still loading, so cards can avoid a flicker. */
    loading: favorites.isPending && enabled,
    /**
     * Saving is unavailable right now.
     *
     * Lets a screen hide the bookmark affordance instead of offering a control
     * that silently fails — the endpoint 500s when the `profiles_favorite`
     * table is missing, and an unreachable feature should look absent, not
     * broken.
     */
    unavailable: favorites.isError,
  };
}

/**
 * A chapter, resolved by address rather than by primary key.
 *
 * The reader knows "John 3", not a chapter UUID, and `/bible/lookup/` takes the
 * address directly — so no list-then-fetch round trip is needed to open a
 * passage from a devotional's Scripture card or a shared link.
 */
export function useScripture(book: string, chapter: number, translation?: string) {
  const params = new URLSearchParams({ book, chapter: String(chapter) });
  if (translation) params.set('translation', translation);

  return useQuery({
    queryKey: keys.passage(book, chapter, translation),
    // The phone first. A chapter read once is kept on the device (see
    // `data/bibleStore.ts`), so opening it again costs no request and needs no
    // signal. Only a chapter this phone has never seen goes to the server.
    queryFn: async () => {
      const saved = await readChapter(book, chapter, translation);
      if (saved) return saved;

      const fetched = await api.get<ScriptureLookup>('/bible/lookup/?' + params.toString());
      writeChapter(fetched, !translation);
      return fetched;
    },
    // Scripture text is immutable, so once fetched it never needs revalidating.
    staleTime: STALE.scripture,
    gcTime: STALE.scripture,
    // Without this the query waits for a connection before it even looks on
    // the phone, which defeats the point of having the chapter saved.
    networkMode: 'always',
    retry: retryTransient,
  });
}

/**
 * Update the signed-in teen's profile.
 *
 * `PATCH /profiles/me/` takes a partial, so this sends only what changed rather
 * than round-tripping the whole record and risking clobbering a field the
 * screen never showed.
 */
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<TeenProfile>) => api.patch<TeenProfile>('/profiles/me/', patch),
    onSuccess: (updated) => {
      qc.setQueryData(keys.profile, updated);
      qc.invalidateQueries({ queryKey: keys.profile });
    },
  });
}

/**
 * Replace the profile picture.
 *
 * Multipart rather than JSON: `avatar` is an ImageField, so the bytes go up as
 * a file part. React Native builds the part from a local file URI plus a name
 * and mime type — there is no File object to hand it.
 */
export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (asset: { uri: string; mimeType?: string; fileName?: string }) => {
      const body = new FormData();
      const name = asset.fileName ?? `avatar.${extensionFor(asset.mimeType)}`;

      // The global fetch here is Expo's, which cannot send React Native's old
      // `{ uri, name, type }` file object: it throws before any request goes
      // out. It sends an expo-file-system `File`, read from the picked image.
      // The web preview has no such file, so it sends the picked image's bytes.
      const file =
        Platform.OS === 'web'
          ? await (await fetch(asset.uri)).blob()
          : (new File(asset.uri) as unknown as Blob);
      body.append('avatar', file, name);

      return api.patch<TeenProfile>('/profiles/me/', body);
    },
    onSuccess: (updated) => {
      // The update reply carries only the writable fields, so only the new
      // photo is copied across; replacing the whole cached profile with it
      // blanked the name and age until the refetch landed.
      qc.setQueryData<TeenProfile>(keys.profile, (old) =>
        old ? { ...old, avatar: updated.avatar } : old,
      );
      qc.invalidateQueries({ queryKey: keys.profile });
    },
  });
}

function extensionFor(mime: string | undefined): string {
  if (!mime) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('heic')) return 'heic';
  return 'jpg';
}

// ─── Notification preferences ──────────────────────────────────────────────

export function useNotificationPreferences(enabled = true) {
  return useQuery({
    queryKey: keys.notificationPrefs,
    queryFn: () => api.get<NotificationPreferences>('/notifications/preferences/'),
    enabled,
    staleTime: STALE.mine,
    retry: retryTransient,
  });
}

/**
 * Change a reminder setting.
 *
 * Optimistic, because a toggle that lags reads as broken. 07-feature-specs
 * describes reminders as a ladder of rungs the server steps down on its own, so
 * the client only ever sets preferences — it never computes which rung is next.
 */
export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) =>
      api.patch<NotificationPreferences>('/notifications/preferences/', patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: keys.notificationPrefs });
      const previous = qc.getQueryData<NotificationPreferences>(keys.notificationPrefs);
      if (previous) {
        qc.setQueryData<NotificationPreferences>(keys.notificationPrefs, { ...previous, ...patch });
      }
      return { previous };
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) qc.setQueryData(keys.notificationPrefs, context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.notificationPrefs }),
  });
}

// ─── Identity & capabilities ───────────────────────────────────────────────

/**
 * The signed-in user's permissions.
 *
 * Long-lived in cache: a teen's role does not change between app launches, and
 * this gates UI on every screen that has a leader affordance.
 */
export function useIdentity(enabled = true) {
  return useQuery({
    queryKey: keys.identity,
    queryFn: () => api.get<Identity>('/identity/me/'),
    enabled,
    staleTime: 30 * 60 * 1000,
    retry: retryTransient,
  });
}

/**
 * Whether the current user holds a permission.
 *
 * Never branches on a role code — 05-navigation.md and the console project
 * notes both require capability checks, because roles are assigned per scope
 * and a role name tells you nothing about what it can do here.
 */
export function useCan(permission: string, enabled = true): boolean {
  const identity = useIdentity(enabled);
  if (!identity.data) return false;
  return identity.data.is_superuser || identity.data.permissions.includes(permission);
}

// ─── Authoring (Console) ───────────────────────────────────────────────────

/**
 * Devotionals awaiting work.
 *
 * The teen Library pins `status=published`; this deliberately asks for the
 * unpublished ones. The endpoint only widens its queryset for users who can
 * manage content, so a teen calling this would simply get nothing back.
 */
export function useDraftDevotionals(enabled = true) {
  return useQuery({
    queryKey: keys.drafts,
    queryFn: async () => {
      const [drafts, review] = await Promise.all([
        fetchAllPages<DevotionalListItem>('/content/devotionals/?status=draft'),
        fetchAllPages<DevotionalListItem>('/content/devotionals/?status=in_review').catch(
          () => [] as DevotionalListItem[],
        ),
      ]);
      return [...drafts, ...review].sort((a, b) => +new Date(b.date) - +new Date(a.date));
    },
    enabled,
    staleTime: STALE.personal,
    retry: retryTransient,
  });
}

/** Move a devotional through the review workflow. */
export function useDevotionalWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: 'submit_for_review' | 'approve' | 'reject' | 'publish';
    }) => api.post<DevotionalListItem>(`/content/devotionals/${id}/${action}/`, {}),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: keys.drafts });
      qc.invalidateQueries({ queryKey: keys.devotional(id) });
      qc.invalidateQueries({ queryKey: keys.devotionals() });
      // Publishing today's devotional changes what Today shows.
      qc.invalidateQueries({ queryKey: keys.today });
    },
  });
}

/**
 * The sign-up church picker.
 *
 * Public, so it works before an account exists. `level` is the kind of node
 * wanted beneath `parent` — asking a zone for its parishes skips the Area
 * level the sign-up flow does not show. With no parent it lists regions.
 */
export function useChurchNodes(
  parent: string | null,
  level: ChurchLevel,
  search = '',
  enabled = true,
) {
  return useQuery({
    queryKey: keys.church(parent, level, search),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (parent) {
        params.set('parent', parent);
        params.set('type', level);
      }
      if (search) params.set('q', search);
      const query = params.toString();
      return api
        .get<{ results: ChurchNode[] }>(
          `/hierarchy/public/children/${query ? `?${query}` : ''}`,
          { anonymous: true, signal },
        )
        .then((body) => body.results);
    },
    enabled,
    staleTime: STALE.catalogue,
    retry: retryTransient,
  });
}

// ─── Library: articles and media ───────────────────────────────────────────

/** Published articles, newest first. */
export function useArticles(search?: string) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  const query = params.toString();

  return useQuery({
    queryKey: keys.articles(search),
    queryFn: async () =>
      unwrap(
        await api.get<Paginated<ArticleListItem>>(`/content/articles/${query ? `?${query}` : ''}`),
      ),
    staleTime: STALE.catalogue,
    retry: retryTransient,
  });
}

export function useArticle(id: string | undefined) {
  return useQuery({
    queryKey: keys.article(id ?? ''),
    queryFn: () => api.get<ArticleDetail>('/content/articles/' + id + '/'),
    enabled: !!id,
    staleTime: STALE.catalogue,
    retry: retryTransient,
  });
}

/**
 * Podcast and video episodes, newest first.
 *
 * One list for both kinds: the Library splits it into Listen and Watch by
 * `has_audio` / `has_video`, so an episode published as both appears on both
 * shelves without a second request.
 */
export function useEpisodes(search?: string) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  const query = params.toString();

  return useQuery({
    queryKey: keys.episodes(search),
    queryFn: async () =>
      unwrap(
        await api.get<Paginated<MediaEpisode>>(`/media/episodes/${query ? `?${query}` : ''}`),
      ),
    staleTime: STALE.catalogue,
    retry: retryTransient,
  });
}

/**
 * One reading or one episode, as query options rather than a hook, for
 * screens that need several at once (`useQueries` on Saved).
 *
 * The episode detail endpoint names its series differently from the list
 * (`series_detail.title`, not `series_title`), so it is brought into the
 * list's shape here and every screen can treat the two alike.
 */
export function devotionalQuery(id: string) {
  return {
    queryKey: keys.devotional(id),
    queryFn: () => api.get<DevotionalDetail>('/content/devotionals/' + id + '/'),
    staleTime: STALE.catalogue,
    retry: retryTransient,
  };
}

export function episodeQuery(id: string) {
  return {
    queryKey: keys.episode(id),
    queryFn: async (): Promise<MediaEpisode> => {
      const episode = await api.get<MediaEpisode & { series_detail?: { title: string } | null }>(
        '/media/episodes/' + id + '/',
      );
      return { ...episode, series_title: episode.series_title ?? episode.series_detail?.title ?? '' };
    },
    staleTime: STALE.catalogue,
    retry: retryTransient,
  };
}

// ─── Bible: search, sharing, bookmarks, history ────────────────────────────

/**
 * Turn "John 3" or "jn 3:16" into an address the reader can open.
 *
 * Used when another screen links into the Bible with only the words of a
 * reference — the continue-reading card knows "John 3", not an OSIS code.
 */
export function useReference(text: string | undefined) {
  return useQuery({
    queryKey: keys.reference(text ?? ''),
    queryFn: () =>
      api.get<ScriptureLookup>('/bible/lookup/?' + new URLSearchParams({ q: text ?? '' }).toString()),
    enabled: !!text,
    staleTime: STALE.scripture,
    retry: retryTransient,
  });
}

export function useScriptureSearch(text: string, translation?: string) {
  const params = new URLSearchParams({ q: text, limit: '40' });
  if (translation) params.set('translation', translation);

  return useQuery({
    queryKey: keys.scriptureSearch(text, translation),
    queryFn: () => api.get<ScriptureSearch>('/bible/search/?' + params.toString()),
    enabled: text.length >= 2,
    staleTime: STALE.scripture,
    retry: retryTransient,
  });
}

export function useBookmarks(enabled = true) {
  return useQuery({
    queryKey: keys.bookmarks,
    queryFn: () => fetchAllPages<Bookmark>('/bible/bookmarks/'),
    enabled,
    staleTime: STALE.mine,
    retry: retryTransient,
  });
}

/**
 * Save or unsave one verse.
 *
 * A bookmark has nothing to edit, so saving creates the row and unsaving
 * deletes it. The list is refetched afterwards rather than patched by hand:
 * the server's copy carries the verse text the Saved screen shows.
 */
export function useToggleBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { verseId: string; bookmarkId?: string }) =>
      input.bookmarkId
        ? api.delete('/bible/bookmarks/' + input.bookmarkId + '/')
        : api.post<Bookmark>('/bible/bookmarks/', { verse: input.verseId }),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.bookmarks }),
  });
}

/**
 * Tell the server a chapter was read.
 *
 * This is what moves "Continue reading" on Today and the chapter count on Me.
 * Every call also writes one entry to the teen's activity history, so the
 * reader calls it once per chapter, never on every visit.
 */
export function useRecordChapterRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (chapterId: string) =>
      api.post('/bible/reading-history/record/', { chapter: chapterId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.today });
      qc.invalidateQueries({ queryKey: keys.progress });
    },
  });
}

// ─── Progress calendar ─────────────────────────────────────────────────────

/** The days of one month the teen did something on. `month` is "YYYY-MM". */
export function useProgressCalendar(month: string, enabled = true) {
  return useQuery({
    queryKey: keys.calendar(month),
    queryFn: () => api.get<ProgressCalendar>('/progress/calendar/?month=' + month),
    enabled,
    staleTime: STALE.mine,
    retry: retryTransient,
  });
}

// ─── Teacher tools ─────────────────────────────────────────────────────────

/**
 * This week's lesson, in the teacher's edition.
 *
 * `manuals/current/` knows which manual belongs to this week, and sends the
 * teacher's notes with it to someone holding `content.view`. An older server
 * answered with the teen edition whoever asked, so if the notes are missing a
 * second request fetches them from the detail route. A week with nothing
 * published is `null`, not an error: it is a normal state the screen has
 * words for.
 */
export function useCurrentLesson(enabled = true) {
  return useQuery({
    queryKey: keys.lesson,
    queryFn: async () => {
      let current: ManualDetail;
      try {
        current = await api.get<ManualDetail>('/content/manuals/current/');
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
      // A server that knows the caller may see the teacher's edition sends it
      // in that first answer, and there is nothing more to ask for.
      if ('has_teacher_edition' in current) return current;
      try {
        return await api.get<ManualDetail>(`/content/manuals/${current.id}/`);
      } catch {
        // The lesson itself is worth showing even if the teacher's half fails.
        return current;
      }
    },
    enabled,
    staleTime: STALE.catalogue,
    retry: retryTransient,
  });
}

/** The class list with this week's reading (identity/class_views.py). */
export function useClassRoster(enabled = true) {
  return useQuery({
    queryKey: keys.classRoster,
    queryFn: () => api.get<ClassRoster>('/identity/class/'),
    enabled,
    staleTime: STALE.personal,
    retry: retryTransient,
  });
}

export function useClassMember(id: string | undefined) {
  return useQuery({
    queryKey: keys.classMember(id ?? ''),
    queryFn: () => api.get<ClassMemberDetail>(`/identity/class/${id}/`),
    enabled: !!id,
    staleTime: STALE.personal,
    retry: retryTransient,
  });
}

/** Events on today that this person may check people in to. Often none. */
export function useCheckInToday(enabled = true) {
  return useQuery({
    queryKey: keys.checkInToday,
    queryFn: async () =>
      (await api.get<{ events: CheckInEvent[] }>('/events/checkin/today/')).events,
    enabled,
    staleTime: STALE.personal,
    retry: retryTransient,
  });
}

/**
 * Send one ticket code to be checked in.
 *
 * A plain function rather than a mutation hook: the scanner also replays
 * scans it saved while offline, from outside any component's render.
 */
export function scanTicket(event: string, code: string, method: 'qr_scan' | 'manual') {
  return api.post<CheckInResult>('/events/checkin/scan/', { event, code, method });
}

/** Find a ticket by name or number. Needs two letters before it asks. */
export function useCheckInSearch(event: string | undefined, text: string) {
  const query = text.trim();
  return useQuery({
    queryKey: keys.checkInSearch(event ?? '', query),
    queryFn: async () =>
      (
        await api.get<{ results: CheckInAttendee[] }>(
          `/events/checkin/search/?event=${event}&q=${encodeURIComponent(query)}`,
        )
      ).results,
    enabled: !!event && query.length >= 2,
    staleTime: 15 * 1000,
    retry: retryTransient,
  });
}
