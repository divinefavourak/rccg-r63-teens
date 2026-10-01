/**
 * Console authorization types.
 *
 * These mirror `backend/identity/permissions_registry.py` exactly. That file is
 * the single source of truth: permission *codes* are code-defined there (a
 * controlled vocabulary), while Role<->Permission *relationships* live in the
 * database and are admin-editable.
 *
 * Consequence for this file: the `Permission` union below must stay in step with
 * `REGISTRY`, but `ROLE_PERMISSIONS`-style tables must NOT be duplicated here.
 * What a role can do is a runtime fact fetched from `/api/v1/identity/me/`, not
 * a compile-time constant — an administrator can change it without a deploy.
 */

/** The 21 registered permission codes. Mirrors `permissions_registry.REGISTRY`. */
export type Permission =
  // Identity / authorization
  | 'users.view'
  | 'users.manage'
  | 'profiles.view'
  | 'profiles.manage'
  | 'memberships.view'
  | 'memberships.manage'
  | 'roles.view'
  | 'roles.assign'
  | 'roles.manage'
  | 'hierarchy.view'
  | 'hierarchy.manage'
  // Content (devotionals, manuals, articles)
  | 'content.view'
  | 'content.publish'
  | 'content.manage'
  // Scripture text. Reading is public; this gates writes only.
  | 'bible.manage'
  // Media (podcasts, videos)
  | 'media.manage'
  // Events, registrations, check-in
  | 'events.view'
  | 'events.manage'
  | 'events.checkin'
  // Payments
  | 'payments.view'
  | 'payments.manage';

/** Every code, for iteration (the Roles matrix renders one row each). */
export const ALL_PERMISSIONS: Permission[] = [
  'users.view',
  'users.manage',
  'profiles.view',
  'profiles.manage',
  'memberships.view',
  'memberships.manage',
  'roles.view',
  'roles.assign',
  'roles.manage',
  'hierarchy.view',
  'hierarchy.manage',
  'content.view',
  'content.publish',
  'content.manage',
  'bible.manage',
  'media.manage',
  'events.view',
  'events.manage',
  'events.checkin',
  'payments.view',
  'payments.manage',
];

/** Human labels, for the Roles matrix and the assign-role summary. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  'users.view': 'See the people list',
  'users.manage': 'Create, edit and deactivate accounts',
  'profiles.view': "Open a member's profile",
  'profiles.manage': "Edit someone else's profile",
  'memberships.view': 'See who belongs where',
  'memberships.manage': 'Add, move and transfer members',
  'roles.view': 'See roles and who holds them',
  'roles.assign': 'Grant and revoke roles',
  'roles.manage': 'Change what a role means',
  'hierarchy.view': 'See the church tree',
  'hierarchy.manage': 'Add, rename and move nodes',
  'content.view': 'See unpublished content',
  'content.publish': 'Approve, schedule and publish',
  'content.manage': 'Create, edit and delete content',
  'bible.manage': 'Import and manage Scripture text',
  'media.manage': 'Manage podcasts, videos and playlists',
  'events.view': 'See the event management list',
  'events.manage': 'Create events and edit registrations',
  'events.checkin': 'Check attendees in at the door',
  'payments.view': 'See payments and reconciliation',
  'payments.manage': 'Issue refunds and payment plans',
};

/**
 * Node types, mirroring `hierarchy.NodeType`. The order is the tree order and is
 * load-bearing: `validate_parent_child` permits exactly one child type beneath
 * each parent type.
 */
export type NodeType =
  | 'national'
  | 'region'
  | 'province'
  | 'zone'
  | 'area'
  | 'parish'
  | 'department';

export const NODE_TYPE_ORDER: NodeType[] = [
  'national',
  'region',
  'province',
  'zone',
  'area',
  'parish',
  'department',
];

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  national: 'National',
  region: 'Region',
  province: 'Province',
  zone: 'Zone',
  area: 'Area',
  parish: 'Parish',
  department: 'Department',
};

/** Shape returned by `NodeRefSerializer` — the trimmed node used in refs. */
export interface NodeRef {
  id: string;
  name: string;
  node_type: NodeType;
}

/** Shape returned by `RoleSerializer`. `permissions` is a list of codes. */
export interface ConsoleRole {
  id: string;
  code: string;
  label: string;
  description: string;
  allowed_node_types: NodeType[];
  permissions: Permission[];
  is_system: boolean;
  is_active: boolean;
}

/** Shape returned by `UserRefSerializer` — enough to name a person in a list. */
export interface UserRef {
  id: string;
  username: string;
  display_name: string;
  email: string;
  is_active: boolean;
}

/** Shape returned by `MembershipSerializer`. Belonging, not authority. */
export interface ConsoleMembership {
  id: string;
  user: string;
  user_detail: UserRef | null;
  organization_node: string;
  organization_node_detail: NodeRef | null;
  is_primary: boolean;
  is_active: boolean;
  joined_at: string;
}

/** Shape returned by `RoleAssignmentSerializer`. Authority, not belonging. */
export interface ConsoleRoleAssignment {
  id: string;
  user: string;
  user_detail: UserRef | null;
  role: string;
  role_detail: ConsoleRole | null;
  node: string;
  node_detail: NodeRef | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  appointed_by: string | null;
  appointed_by_detail: UserRef | null;
  created_at: string;
}

export interface ConsoleProfile {
  id: string;
  display_name: string;
  photo: string | null;
  gender: string;
  birthday: string | null;
  bio: string;
  timezone: string;
  preferences: Record<string, unknown>;
  updated_at: string;
}

/**
 * `GET /api/v1/identity/me/` — `MeSerializer`.
 *
 * One call bootstraps the whole authz UI: who you are, where you belong, what
 * authority you hold and where, and the union of permissions that authority
 * grants.
 *
 * **`permissions` is a union across every node you hold a role at**, not a
 * per-node answer (`authorization.effective_permissions`). For the common case —
 * one role at one node — union and per-node are identical. For someone holding
 * roles at two different nodes they differ, and this field will over-report
 * relative to any single scope. See `useConsoleAuth` for how that is handled.
 */
export interface MeResponse {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_superuser: boolean;
  profile: ConsoleProfile | null;
  memberships: ConsoleMembership[];
  role_assignments: ConsoleRoleAssignment[];
  permissions: Permission[];
}

/**
 * Full hierarchy node, as returned by `HierarchyNodeSerializer`.
 *
 * `path` and `depth` are exposed deliberately: a materialized path is sliceable,
 * so the client can compute ancestry, breadcrumbs and subtree membership locally
 * instead of paying a round trip for each.
 */
export interface HierarchyNodeDto {
  id: string;
  name: string;
  node_type: NodeType;
  /** Optional external church code, used for CSV reconciliation. */
  code?: string;
  slug?: string;
  path: string;
  depth: number;
  is_active?: boolean;
  parent?: string | null;
}
