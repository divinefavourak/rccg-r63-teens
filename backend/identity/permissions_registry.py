"""
Code-defined permission vocabulary and the canonical role seed.

Per the Phase 1B decision: permission *identifiers* are defined here in code (a
controlled, type-safe vocabulary — no arbitrary strings in the DB), while the
Role<->Permission *relationships* are stored in the database and editable by
administrators (reconfigure authority without a deploy). `seed_rbac` reconciles
the database to this registry idempotently.

Only identity/authorization-domain permissions are registered in this phase.
Later phases add their own (e.g. `events.create`, `content.publish`) by
extending REGISTRY — the verbs below already exist for them.
"""


class Verb:
    VIEW = 'view'
    CREATE = 'create'
    UPDATE = 'update'
    DELETE = 'delete'
    APPROVE = 'approve'
    PUBLISH = 'publish'
    MANAGE = 'manage'   # umbrella: full control of the resource


def perm(resource, verb):
    return f'{resource}.{verb}'


class Perm:
    """Canonical permission codes."""
    # Identity / authorization domain
    USERS_VIEW = 'users.view'
    USERS_MANAGE = 'users.manage'
    PROFILES_VIEW = 'profiles.view'
    PROFILES_MANAGE = 'profiles.manage'
    MEMBERSHIPS_VIEW = 'memberships.view'
    MEMBERSHIPS_MANAGE = 'memberships.manage'
    ROLES_VIEW = 'roles.view'
    ROLES_ASSIGN = 'roles.assign'
    ROLES_MANAGE = 'roles.manage'
    HIERARCHY_VIEW = 'hierarchy.view'
    HIERARCHY_MANAGE = 'hierarchy.manage'
    # Content (devotionals, manuals, articles)
    CONTENT_VIEW = 'content.view'
    CONTENT_PUBLISH = 'content.publish'
    CONTENT_MANAGE = 'content.manage'
    # Media (podcasts, videos)
    MEDIA_MANAGE = 'media.manage'
    # Events, registrations, check-in
    EVENTS_VIEW = 'events.view'
    EVENTS_MANAGE = 'events.manage'
    EVENTS_CHECKIN = 'events.checkin'
    # Payments
    PAYMENTS_VIEW = 'payments.view'
    PAYMENTS_MANAGE = 'payments.manage'


# (code, human label) — the full registered vocabulary for this phase.
REGISTRY = [
    (Perm.USERS_VIEW, 'View users'),
    (Perm.USERS_MANAGE, 'Manage users'),
    (Perm.PROFILES_VIEW, 'View profiles'),
    (Perm.PROFILES_MANAGE, 'Manage profiles'),
    (Perm.MEMBERSHIPS_VIEW, 'View memberships'),
    (Perm.MEMBERSHIPS_MANAGE, 'Manage memberships'),
    (Perm.ROLES_VIEW, 'View roles'),
    (Perm.ROLES_ASSIGN, 'Assign roles'),
    (Perm.ROLES_MANAGE, 'Manage roles & permissions'),
    (Perm.HIERARCHY_VIEW, 'View organization hierarchy'),
    (Perm.HIERARCHY_MANAGE, 'Manage organization hierarchy'),
    (Perm.CONTENT_VIEW, 'View unpublished/all content'),
    (Perm.CONTENT_PUBLISH, 'Publish content'),
    (Perm.CONTENT_MANAGE, 'Create/edit/delete content'),
    (Perm.MEDIA_MANAGE, 'Create/edit/delete media'),
    (Perm.EVENTS_VIEW, 'View event management data'),
    (Perm.EVENTS_MANAGE, 'Create/edit events and registrations'),
    (Perm.EVENTS_CHECKIN, 'Check in event attendees'),
    (Perm.PAYMENTS_VIEW, 'View payments/reconciliation'),
    (Perm.PAYMENTS_MANAGE, 'Manage payments/refunds'),
]

ALL_PERMISSION_CODES = [code for code, _ in REGISTRY]


# Node types (mirror hierarchy.NodeType values) a role may be assigned at.
# Kept as plain strings to avoid importing hierarchy at module import time.
_NATIONAL, _REGION, _PROVINCE, _ZONE, _AREA, _PARISH = (
    'national', 'region', 'province', 'zone', 'area', 'parish',
)

# Canonical roles. `permissions` is a list of Perm codes; `allowed_node_types`
# constrains where a RoleAssignment for this role may be scoped.
ROLE_SEED = [
    {
        'code': 'super_admin',
        'label': 'Super Admin',
        'allowed_node_types': [_NATIONAL],
        'permissions': ALL_PERMISSION_CODES,
        'is_system': True,
    },
    {
        'code': 'national_coordinator',
        'label': 'National Coordinator',
        'allowed_node_types': [_NATIONAL],
        'permissions': [
            Perm.USERS_VIEW, Perm.USERS_MANAGE, Perm.PROFILES_VIEW,
            Perm.MEMBERSHIPS_VIEW, Perm.MEMBERSHIPS_MANAGE,
            Perm.ROLES_VIEW, Perm.ROLES_ASSIGN,
            Perm.HIERARCHY_VIEW, Perm.HIERARCHY_MANAGE,
            Perm.CONTENT_VIEW, Perm.CONTENT_PUBLISH, Perm.CONTENT_MANAGE,
            Perm.MEDIA_MANAGE, Perm.EVENTS_VIEW, Perm.EVENTS_MANAGE,
            Perm.EVENTS_CHECKIN, Perm.PAYMENTS_VIEW, Perm.PAYMENTS_MANAGE,
        ],
        'is_system': True,
    },
    {
        'code': 'regional_coordinator',
        'label': 'Regional Coordinator',
        'allowed_node_types': [_REGION],
        'permissions': [
            Perm.USERS_VIEW, Perm.USERS_MANAGE, Perm.PROFILES_VIEW,
            Perm.MEMBERSHIPS_VIEW, Perm.MEMBERSHIPS_MANAGE,
            Perm.ROLES_VIEW, Perm.ROLES_ASSIGN, Perm.HIERARCHY_VIEW,
            Perm.CONTENT_VIEW, Perm.CONTENT_PUBLISH, Perm.CONTENT_MANAGE,
            Perm.MEDIA_MANAGE, Perm.EVENTS_VIEW, Perm.EVENTS_MANAGE,
            Perm.EVENTS_CHECKIN, Perm.PAYMENTS_VIEW,
        ],
        'is_system': True,
    },
    {
        'code': 'province_coordinator',
        'label': 'Province Coordinator',
        'allowed_node_types': [_PROVINCE],
        'permissions': [
            Perm.USERS_VIEW, Perm.PROFILES_VIEW,
            Perm.MEMBERSHIPS_VIEW, Perm.MEMBERSHIPS_MANAGE,
            Perm.ROLES_VIEW, Perm.HIERARCHY_VIEW,
            Perm.CONTENT_VIEW, Perm.EVENTS_VIEW, Perm.EVENTS_MANAGE,
            Perm.EVENTS_CHECKIN, Perm.PAYMENTS_VIEW,
        ],
        'is_system': True,
    },
    {
        'code': 'parish_leader',
        'label': 'Parish Leader',
        'allowed_node_types': [_PARISH],
        'permissions': [
            Perm.USERS_VIEW, Perm.PROFILES_VIEW,
            Perm.MEMBERSHIPS_VIEW, Perm.HIERARCHY_VIEW,
            Perm.CONTENT_VIEW, Perm.EVENTS_VIEW, Perm.EVENTS_CHECKIN,
        ],
        'is_system': True,
    },
    {
        'code': 'teacher',
        'label': 'Teacher',
        'allowed_node_types': [_PARISH, _AREA],
        'permissions': [
            Perm.USERS_VIEW, Perm.PROFILES_VIEW,
            Perm.CONTENT_VIEW, Perm.EVENTS_CHECKIN,
        ],
        'is_system': True,
    },
    {
        'code': 'teen',
        'label': 'Teen',
        'allowed_node_types': [_PARISH],
        'permissions': [],  # self-service only; guarded by object ownership, not roles
        'is_system': True,
    },
    {
        'code': 'parent',
        'label': 'Parent',
        'allowed_node_types': [],   # linked to a teen, not an org node (future)
        'permissions': [],
        'is_system': True,
    },
]
