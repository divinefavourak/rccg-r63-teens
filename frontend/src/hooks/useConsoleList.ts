/**
 * Fetch a Console list endpoint.
 *
 * Wraps the two things every Console list needs and every screen was otherwise
 * about to reimplement: tolerating DRF's paginated *and* bare-array shapes, and
 * carrying loading/error/reload state.
 *
 * `enabled: false` skips the request entirely rather than firing one we know
 * will 403 — an endpoint the caller has no permission for should not appear in
 * their network log at all, because it reads as a bug when they go looking.
 *
 * Backed by TanStack Query. The previous implementation was a useState +
 * useEffect pair with no cache and no in-flight deduplication, which had two
 * costs on a slow connection: navigating away and back refetched everything from
 * scratch, and two components asking for the same path made two identical
 * requests. Query keys are (path, params), so those are now one request and one
 * cached answer.
 *
 * The returned shape is unchanged, so no screen had to be touched.
 */
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';

/** DRF returns `{count, results}` when paginated and a bare array when not. */
export function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const results = (data as { results?: T[] } | null)?.results;
  return Array.isArray(results) ? results : [];
}

interface Options {
  /** Skip the request when the caller cannot use this endpoint. */
  enabled?: boolean;
  /** Query params, appended as-is. */
  params?: Record<string, string | number | undefined>;
  /** Shown when the request fails. */
  errorMessage?: string;
}

const EMPTY: never[] = [];

export function useConsoleList<T>(path: string, options: Options = {}) {
  const {
    enabled = true,
    params,
    errorMessage = 'Could not load this list.',
  } = options;

  const queryClient = useQueryClient();

  // Serialised so the key depends on the params' *value*, not the object
  // identity — an inline `params={{...}}` would otherwise produce a new key,
  // and therefore a new request, on every render.
  const serialisedParams = JSON.stringify(params ?? {});
  const queryKey = ['console-list', path, serialisedParams] as const;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await api.get(path, { params: JSON.parse(serialisedParams) });
      return unwrapList<T>(data);
    },
    enabled,
  });

  const reload = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    // queryKey is a fresh array each render but its *contents* are what
    // invalidateQueries matches on, so depending on the serialised parts is both
    // correct and stable.
    [queryClient, path, serialisedParams], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const setItems = useCallback(
    (next: T[]) => queryClient.setQueryData(queryKey, next),
    [queryClient, path, serialisedParams], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return {
    items: query.data ?? (EMPTY as T[]),
    // isPending is true whenever there is no data yet, including while disabled;
    // a disabled query has nothing to load, so it must not read as loading.
    isLoading: enabled && query.isPending,
    error: query.isError ? errorMessage : null,
    reload,
    setItems,
  };
}
