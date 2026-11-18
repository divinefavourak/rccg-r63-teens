import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from './client';
import { STALE } from './config';
import { retryTransient } from './queries';
import type {
  LeaderRole,
  Paginated,
  PersonAccount,
  PersonMembership,
  PersonRole,
  TreeNode,
} from './types';

/**
 * People, for leaders: who is in their part of the church, and the changes a
 * coordinator may make to them (the web Console's People screen, on a phone).
 *
 * Every list here is scoped by the server to where the caller holds the
 * permission, and every change is checked there again; nothing on the phone
 * widens what someone can reach. The keys start with `console`, which
 * `persist.ts` never writes to the device: other people's details are not left
 * on a leader's phone between launches.
 */

const PAGE_SIZE = 30;

export const peopleKeys = {
  all: ['console', 'people'] as const,
  list: (search: string) => ['console', 'people', 'list', search] as const,
  membership: (id: string) => ['console', 'people', 'membership', id] as const,
  account: (userId: string) => ['console', 'people', 'account', userId] as const,
  roles: (userIds: string) => ['console', 'people', 'roles', userIds] as const,
  catalogue: ['console', 'roles'] as const,
  tree: ['console', 'tree'] as const,
};

/**
 * Everyone whose home is in the caller's part of the tree, a page at a time.
 *
 * Primary memberships only, so someone who also belongs to a department is
 * listed once. The server searches first name, last name, username, e-mail
 * and display name.
 */
export function usePeople(search: string, enabled = true) {
  const query = search.trim();
  return useInfiniteQuery({
    queryKey: peopleKeys.list(query),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        is_active: 'true',
        is_primary: 'true',
        page: String(pageParam),
        page_size: String(PAGE_SIZE),
      });
      if (query) params.set('search', query);
      return api.get<Paginated<PersonMembership>>(`/identity/memberships/?${params}`);
    },
    getNextPageParam: (last, pages) => (last.next ? pages.length + 1 : undefined),
    enabled,
    staleTime: STALE.mine,
    retry: retryTransient,
  });
}

export function usePersonMembership(id: string | undefined) {
  return useQuery({
    queryKey: peopleKeys.membership(id ?? ''),
    queryFn: () => api.get<PersonMembership>(`/identity/memberships/${id}/`),
    enabled: !!id,
    staleTime: STALE.mine,
    retry: retryTransient,
  });
}

/** Their account: name, contact, whether it is switched on. Needs users.manage. */
export function usePersonAccount(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: peopleKeys.account(userId ?? ''),
    queryFn: () => api.get<PersonAccount>(`/auth/users/${userId}/`),
    enabled: enabled && !!userId,
    staleTime: STALE.mine,
    retry: retryTransient,
  });
}

/** The roles these people hold now. Needs roles.view; one request per page. */
export function usePeopleRoles(userIds: string[], enabled = true) {
  const ids = [...userIds].sort().join(',');
  return useQuery({
    queryKey: peopleKeys.roles(ids),
    queryFn: () =>
      api.get<Paginated<PersonRole> | PersonRole[]>(
        `/identity/role-assignments/?is_active=true&page_size=200&users=${ids}`,
      ),
    select: (payload) => (Array.isArray(payload) ? payload : payload.results),
    enabled: enabled && ids.length > 0,
    staleTime: STALE.mine,
    retry: retryTransient,
  });
}

/** Every role there is, with what it may do and where. Needs roles.view. */
export function useRoleCatalogue(enabled = true) {
  return useQuery({
    queryKey: peopleKeys.catalogue,
    queryFn: () => api.get<Paginated<LeaderRole> | LeaderRole[]>('/identity/roles/?page_size=100'),
    select: (payload) => (Array.isArray(payload) ? payload : payload.results),
    enabled,
    staleTime: STALE.catalogue,
    retry: retryTransient,
  });
}

/** The caller's part of the tree, with `selectable` on the nodes they lead. */
export function useLeaderTree(enabled = true) {
  return useQuery({
    queryKey: peopleKeys.tree,
    queryFn: async () => (await api.get<{ results: TreeNode[] }>('/hierarchy/nodes/')).results,
    enabled,
    staleTime: STALE.catalogue,
    retry: retryTransient,
  });
}

/**
 * Whatever a change touches, the list, the person and their roles are read
 * again: a new role shows as a badge in the list, a move changes the home
 * shown under the name.
 */
function useRefreshPeople() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: peopleKeys.all });
}

export type AccountPatch = Partial<
  Pick<PersonAccount, 'first_name' | 'last_name' | 'email' | 'phone' | 'gender' | 'is_active'>
>;

export function useUpdateAccount(userId: string) {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: (patch: AccountPatch) => api.patch<PersonAccount>(`/auth/users/${userId}/`, patch),
    onSuccess: refresh,
  });
}

export function useGrantRole() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: (body: { user: string; role: string; node: string }) =>
      api.post<PersonRole>('/identity/role-assignments/', body),
    onSuccess: refresh,
  });
}

/** A soft end: the assignment is kept, marked no longer active. */
export function useRevokeRole() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: (assignmentId: string) => api.delete(`/identity/role-assignments/${assignmentId}/`),
    onSuccess: refresh,
  });
}

export function useMovePerson(membershipId: string) {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: (body: { to_node: string; reason: string }) =>
      api.post(`/identity/memberships/${membershipId}/transfer/`, body),
    onSuccess: refresh,
  });
}

/**
 * The roles this person may be given here.
 *
 * Mirrors the server's two rules so the phone never offers a grant it would
 * refuse: the role must be allowed at this level of the tree, and (unless
 * the caller is a superuser) every permission in it must be one the caller
 * holds. The server checks both again, at the node itself. Roles with no
 * permissions at all (Teen, Parent) are left out: they confer nothing, and a
 * teen is a teen by belonging to a parish, not by holding a role.
 */
export function grantableRoles(
  roles: LeaderRole[],
  nodeType: string | undefined,
  mine: { permissions: string[]; isSuperuser: boolean },
  alreadyHeld: Set<string>,
): LeaderRole[] {
  if (!nodeType) return [];
  const held = new Set(mine.permissions);
  if (!mine.isSuperuser && !held.has('roles.assign')) return [];
  return roles
    .filter((role) => role.is_active !== false && role.permissions.length > 0)
    .filter((role) => (role.allowed_node_types ?? []).includes(nodeType as never))
    .filter((role) => mine.isSuperuser || role.permissions.every((p) => held.has(p)))
    .filter((role) => !alreadyHeld.has(role.id))
    .sort((a, b) => a.permissions.length - b.permissions.length);
}

/** A person's name as a leader would say it. */
export function personName(membership: PersonMembership | undefined): string {
  const ref = membership?.user_detail;
  return ref?.display_name?.trim() || ref?.username || 'Someone';
}
