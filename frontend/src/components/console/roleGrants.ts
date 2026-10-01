/**
 * The escalation guard, mirrored client-side.
 *
 * Mirrors `identity.authorization.can_assign` and `validate_role_assignment`.
 * The server is the enforcement boundary — this exists so the UI never *offers*
 * a grant the server is going to refuse, which would make the operator look
 * incompetent to themselves.
 *
 * Roles are fetched from `/api/v1/identity/roles/`, never hardcoded: an
 * administrator can change what a role means without a deploy, so a baked-in
 * table would desync the moment they did.
 */
import type { ConsoleRole, NodeType, Permission } from '../../types/console';

/**
 * May a role be granted at a node of this type?
 *
 * Mirrors `validate_role_assignment`. Note that `assign_role` runs this check
 * **before** the escalation check and unconditionally — so a role with no
 * allowed node types is ungrantable by anyone, superuser included.
 */
export function validAtNodeType(role: ConsoleRole, nodeType: NodeType): boolean {
  return (role.allowed_node_types ?? []).includes(nodeType);
}

/**
 * Is this role grantable *anywhere at all*?
 *
 * `parent` has an empty `allowed_node_types` — it is linked to a teen rather
 * than to an org node — so it can never be assigned. It should not appear in a
 * role picker for anyone, at any node, including a Super Admin's.
 */
export function isGrantableAnywhere(role: ConsoleRole): boolean {
  return (role.allowed_node_types ?? []).length > 0;
}

/**
 * The subset rule: you may only grant a role whose permissions you already hold.
 *
 * Mirrors `can_assign`. Two consequences worth stating, because both look like
 * bugs until you work them through:
 *
 *  - A National Coordinator (19 permissions) cannot grant Super Admin (21) —
 *    they lack `roles.manage` and `profiles.manage`.
 *  - **Anyone with `roles.assign` can grant `teen`**, because `teen` carries no
 *    permissions and the empty set is a subset of every set. What stops a teen
 *    role being handed out at a region is the node-level rule, not this one.
 */
export function satisfiesSubsetRule(
  granterPermissions: Set<Permission>,
  role: ConsoleRole,
  granterIsSuperuser = false,
): boolean {
  if (granterIsSuperuser) return true;
  if (!granterPermissions.has('roles.assign')) return false;
  return (role.permissions ?? []).every((p) => granterPermissions.has(p));
}

export interface GrantableRole {
  role: ConsoleRole;
  /** Valid at the currently chosen node, if one has been chosen. */
  validHere: boolean;
  /** Why it is not valid here — shown on the greyed card. */
  reason?: string;
}

/**
 * The role picker's contents for a given granter, optionally narrowed to a node.
 *
 * Roles the granter may never grant are **omitted**, not greyed: showing someone
 * an authority they can never hold teaches them nothing. Roles they *could*
 * grant but not *here* are returned with `validHere: false` and a reason, because
 * that one is fixable by choosing a different node.
 */
export function grantableRoles(
  allRoles: ConsoleRole[],
  granterPermissions: Set<Permission>,
  options: { granterIsSuperuser?: boolean; nodeType?: NodeType } = {},
): GrantableRole[] {
  const { granterIsSuperuser = false, nodeType } = options;

  return allRoles
    .filter((role) => role.is_active)
    .filter(isGrantableAnywhere)
    .filter((role) =>
      satisfiesSubsetRule(granterPermissions, role, granterIsSuperuser),
    )
    .map((role) => {
      if (!nodeType) return { role, validHere: true };
      const ok = validAtNodeType(role, nodeType);
      return {
        role,
        validHere: ok,
        reason: ok
          ? undefined
          : `A ${role.label} can only be assigned at ${formatLevels(role.allowed_node_types)}.`,
      };
    });
}

/**
 * A calm line for a leader who searched for a role they cannot grant.
 *
 * Derived from the data rather than hardcoded: the answer is whichever roles
 * hold every permission the target role carries, plus `roles.assign`.
 */
export function whoCanGrant(
  target: ConsoleRole,
  allRoles: ConsoleRole[],
): string | null {
  if (!isGrantableAnywhere(target)) {
    return `${target.label} is not assigned through the Console — it is linked to a teen, not to a place in the tree.`;
  }

  const capable = allRoles.filter((r) => {
    if (r.id === target.id) return false;
    const codes = new Set(r.permissions ?? []);
    if (!codes.has('roles.assign')) return false;
    return (target.permissions ?? []).every((p) => codes.has(p));
  });

  if (capable.length === 0) {
    return `Only a superuser can appoint a ${target.label}.`;
  }
  // The least-powerful role that can do it is the most useful answer — it names
  // the nearest person who can help, not the most senior.
  const fewest = capable.reduce((a, b) =>
    (a.permissions?.length ?? 0) <= (b.permissions?.length ?? 0) ? a : b,
  );
  return `Only ${indefinite(fewest.label)} or above can appoint ${indefinite(target.label)}.`;
}

function formatLevels(levels: NodeType[] | undefined): string {
  const list = (levels ?? []).map(
    (l) => l.charAt(0).toUpperCase() + l.slice(1),
  );
  if (list.length === 0) return 'no level';
  if (list.length === 1) return `${list[0]} level`;
  return `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]} level`;
}

function indefinite(label: string): string {
  return /^[AEIOU]/i.test(label) ? `an ${label}` : `a ${label}`;
}
