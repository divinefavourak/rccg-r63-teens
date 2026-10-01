/**
 * Console navigation model.
 *
 * The sidebar is *computed*, never authored per role. There is one Console with
 * as many shapes as there are permission sets — not six products. Every item
 * declares the permission that unlocks it and, where the distinction exists, the
 * permission that upgrades it from reading to editing.
 *
 * Adding a screen means adding a row here. If you find yourself writing
 * `if (role === 'teacher')` anywhere in the Console, this file is the thing you
 * should have changed instead: roles are database rows an administrator can
 * edit, so branching on a role code bakes in an assumption the backend
 * explicitly refuses to make.
 */
import type { Permission } from '../../types/console';

/** `true` = full access, `'readonly'` = visible but not editable, `false` = absent. */
export type NavAccess = true | 'readonly' | false;

export interface NavItem {
  /** Route segment under /admin. */
  id: string;
  label: string;
  /** lucide-react icon name, resolved by the Sidebar. */
  icon: string;
  /** Renders a separator above this item. */
  divider?: boolean;
  /** Decides presence and read/write state from the permission set. */
  access: (p: Set<Permission>) => NavAccess;
}

const has = (p: Set<Permission>, code: Permission) => p.has(code);

/**
 * Read-or-write helper: absent without `view`, read-only without `manage`.
 * This is the shape most Console areas take.
 */
const readWrite =
  (view: Permission, manage: Permission) =>
  (p: Set<Permission>): NavAccess =>
    !has(p, view) ? false : has(p, manage) ? true : 'readonly';

export const NAV_ITEMS: NavItem[] = [
  { id: '', label: 'Overview', icon: 'LayoutDashboard', access: () => true },

  {
    id: 'people',
    label: 'People',
    icon: 'Users',
    access: readWrite('memberships.view', 'memberships.manage'),
  },
  {
    id: 'hierarchy',
    label: 'Hierarchy',
    icon: 'Network',
    access: readWrite('hierarchy.view', 'hierarchy.manage'),
  },
  {
    id: 'roles',
    label: 'Roles & permissions',
    icon: 'ShieldCheck',
    // roles.view sees who holds what; only roles.manage may redefine a role.
    // In the seeded set that makes this editable by Super Admin alone.
    access: readWrite('roles.view', 'roles.manage'),
  },

  {
    id: 'content',
    label: 'Content',
    icon: 'BookOpen',
    divider: true,
    // content.view without content.manage is a real, intended state: a Province
    // Coordinator reads the devotional calendar as a forecast of what their
    // teens will receive, with no authoring toolbar at all. Gating this on
    // content.manage would remove their only view of it.
    access: readWrite('content.view', 'content.manage'),
  },
  {
    id: 'review',
    label: 'Review queue',
    icon: 'CheckSquare',
    // The two-person gate. Only someone who can publish can clear the queue.
    access: (p) => (has(p, 'content.publish') ? true : false),
  },
  {
    id: 'manuals',
    label: 'Manuals',
    icon: 'FileText',
    access: readWrite('content.view', 'content.manage'),
  },
  {
    id: 'media',
    label: 'Library & Media',
    icon: 'PlayCircle',
    access: (p) => (has(p, 'media.manage') ? true : false),
  },
  {
    id: 'bible',
    label: 'Bible',
    icon: 'Cross',
    // Reading Scripture needs no permission — it is public. This screen is the
    // import/translation manager, so it is gated on the write permission.
    access: (p) => (has(p, 'bible.manage') ? true : false),
  },

  {
    id: 'events',
    label: 'Events',
    icon: 'Calendar',
    divider: true,
    access: readWrite('events.view', 'events.manage'),
  },
  {
    id: 'check-in',
    label: 'Check in',
    icon: 'ScanLine',
    // Someone who can browse events reaches check-in *through* an event, so a
    // top-level entry would be redundant for them. This item exists for the
    // holder who can see events but not manage them — a Parish Leader running
    // the door. See `my-class` for the Teacher case.
    access: (p) =>
      has(p, 'events.checkin') && has(p, 'events.view') && !has(p, 'events.manage'),
  },
  {
    id: 'my-class',
    label: 'My class',
    icon: 'GraduationCap',
    // A Teacher holds events.checkin but NOT events.view, so check-in is
    // unreachable by drilling into an event list they cannot open. This is
    // their whole Console: their teens, their lesson, and the door.
    access: (p) => has(p, 'events.checkin') && !has(p, 'events.view'),
  },

  {
    id: 'notifications',
    label: 'Notifications',
    icon: 'Bell',
    divider: true,
    // ASSUMPTION, not backend fact: there is no notifications.* permission in
    // permissions_registry.py. Mapped to users.manage because sending to a
    // congregation is an act of authority over people. If this becomes a real
    // permission code, change it here and nowhere else.
    access: (p) => (has(p, 'users.manage') ? true : false),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: 'BarChart3',
    // ASSUMPTION, as above. Gated on the permission for the most sensitive data
    // the screen displays.
    access: (p) => (has(p, 'payments.view') ? true : false),
  },

  { id: 'settings', label: 'Settings', icon: 'Settings', divider: true, access: () => true },
  {
    id: 'audit-log',
    label: 'Audit log',
    icon: 'ScrollText',
    access: (p) => (has(p, 'hierarchy.manage') ? true : false),
  },
];

export interface ResolvedNavItem extends NavItem {
  access: (p: Set<Permission>) => NavAccess;
  result: true | 'readonly';
  /** Absolute route path. */
  to: string;
}

/**
 * The sidebar for a given permission set — items the holder can actually reach.
 *
 * Unreachable items are dropped, not disabled: a control the user has no
 * authority to use is absent. See `PermissionGate` for the rule and its two
 * deliberate exceptions.
 */
export function computeNav(permissions: Set<Permission>): ResolvedNavItem[] {
  const resolved = NAV_ITEMS.map((item) => ({
    ...item,
    result: item.access(permissions),
    to: item.id ? `/admin/${item.id}` : '/admin',
  }));
  // A type predicate rather than a cast: `access` genuinely can return false, so
  // asserting it away before the filter would make the filter dead code and hide
  // the very thing it is there to do.
  return resolved.filter(
    (item): item is ResolvedNavItem => item.result !== false,
  );
}

/** Look up a nav item by its route id — used to gate a route on direct entry. */
export function navItemFor(id: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.id === id);
}
