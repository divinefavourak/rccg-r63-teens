/**
 * Counts for the caller's scope, from `GET /identity/stats/`.
 *
 * Use this for any number the Console shows as a total. A list endpoint
 * answers one page (20 rows by default), so `items.length` is the size of the
 * page, not of the scope: a region with 1,842 members would read as 20.
 *
 * The backend omits a section the caller has no permission for, so every
 * section is optional. An absent section means "not yours to see", not zero.
 */
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';

export interface ConsoleStats {
  days: number;
  /** The caller's primary membership node. Not the node the figures cover. */
  scope: { id: string; name: string; node_type: string } | null;
  sections: {
    people?: {
      total: number;
      by_node: { name: string; node_type: string; count: number }[];
    };
    events?: {
      events_total: number;
      events_upcoming: number;
      registrations: {
        total: number;
        checked_in: number;
        pending: number;
        confirmed: number;
      };
      /** Registrations created in the last `days` days. */
      registrations_recent: number;
      /** Null when there are no registrations to take a rate of. */
      check_in_rate: number | null;
    };
    content?: {
      total: number;
      published: number;
      in_review: number;
      draft: number;
      approved: number;
      scheduled: number;
      /** `gaps` are ISO dates in the next 14 days with nothing approved. */
      coverage_next_14: { covered: number; gaps: string[] };
    };
  };
}

export function useConsoleStats(days = 30) {
  const query = useQuery({
    queryKey: ['console-stats', days],
    queryFn: async () => {
      const { data } = await api.get<ConsoleStats>('/identity/stats/', {
        params: { days },
      });
      return data;
    },
  });

  return {
    stats: query.data,
    isLoading: query.isPending,
    error: query.isError ? 'Could not load the figures for your scope.' : null,
    reload: query.refetch,
  };
}
