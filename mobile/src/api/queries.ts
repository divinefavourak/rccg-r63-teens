import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, ApiError, fetchAllPages } from './client';
import { STALE } from './config';
import type {
  AppNotification,
  EventRegistration,
  EventRegistrationDetail,
  EventRegistrationInput,
  Favorite,
  TeenProfile,
  Identity,
  NotificationPreferences,
  BibleBook,
  BibleChapterDetail,
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
  translations: ['bible', 'translations'] as const,
  books: ['bible', 'books'] as const,
  chapter: (id: string) => ['bible', 'chapter', id] as const,
  passage: (book: string, chapter: number, translation?: string) =>
    ['bible', 'passage', book, chapter, translation ?? 'default'] as const,
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
    staleTime: STALE.personal,
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
    staleTime: STALE.personal,
    retry: retryTransient,
  });
}

export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: keys.unreadCount,
    queryFn: () => api.get<{ unread_count: number }>('/notifications/inbox/unread_count/'),
    enabled,
    staleTime: STALE.personal,
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
    staleTime: STALE.personal,
    retry: retryTransient,
  });
}

export function useFavorites(enabled = true) {
  return useQuery({
    queryKey: keys.favorites,
    queryFn: async () => unwrap(await api.get<Paginated<Favorite>>('/profiles/favorites/')),
    enabled,
    staleTime: STALE.personal,
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
    staleTime: STALE.personal,
    retry: retryTransient,
  });
}

// ─── Bible ─────────────────────────────────────────────────────────────────

export function useTranslations() {
  return useQuery({
    queryKey: keys.translations,
    queryFn: async () => unwrap(await api.get<Paginated<BibleTranslation>>('/bible/translations/')),
    staleTime: STALE.scripture,
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
      const rows = await fetchAllPages<BibleBook>('/bible/books/');

      const byOsis = new Map<string, BibleBook>();
      for (const book of rows) {
        if (!byOsis.has(book.osis_code)) byOsis.set(book.osis_code, book);
      }

      return [...byOsis.values()].sort((a, b) => a.book_number - b.book_number);
    },
    staleTime: STALE.scripture,
    gcTime: STALE.scripture,
    retry: retryTransient,
  });
}

export function useChapter(id: string | undefined) {
  return useQuery({
    queryKey: keys.chapter(id ?? ''),
    queryFn: () => api.get<BibleChapterDetail>('/bible/chapters/' + id + '/'),
    enabled: !!id,
    // Scripture text is immutable, so once fetched it never needs revalidating.
    staleTime: STALE.scripture,
    gcTime: STALE.scripture,
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
    queryFn: () => api.get<ScriptureLookup>('/bible/lookup/?' + params.toString()),
    // Scripture text is immutable, so once fetched it never needs revalidating.
    staleTime: STALE.scripture,
    gcTime: STALE.scripture,
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
    mutationFn: (asset: { uri: string; mimeType?: string; fileName?: string }) => {
      const body = new FormData();
      const name = asset.fileName ?? `avatar.${extensionFor(asset.mimeType)}`;

      body.append('avatar', {
        uri: asset.uri,
        name,
        type: asset.mimeType ?? 'image/jpeg',
        // RN's FormData accepts this shape; the DOM typings do not describe it.
      } as unknown as Blob);

      return api.patch<TeenProfile>('/profiles/me/', body);
    },
    onSuccess: (updated) => {
      qc.setQueryData(keys.profile, updated);
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
    staleTime: STALE.personal,
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
    staleTime: 10 * 60 * 1000,
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
