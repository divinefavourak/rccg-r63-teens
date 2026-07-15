# 05 — Hierarchy bootstrap

The church tree — National → Region → Province → Zone → Area → Parish — is the
backbone the whole product scopes against: content visibility, event audiences,
RBAC subtrees, analytics. Until it exists, scoping has nothing to evaluate and
falls open (everyone sees everything).

The production audit found **zero nodes**. This runbook builds them.

---

## Two ways to build the tree

### A. Derive it from existing users (production)

```
python manage.py derive_hierarchy
```

Reads every user's `province` / `zone` / `area` / `parish` fields and builds the
nodes they imply under `Region 63`, creating one primary membership per user at the
deepest node their data reaches. Users with no province land in an **"Unassigned"**
province bucket under the region — a real, visible place, not a null.

Idempotent (`get_or_create` throughout), so re-running after correcting a user's
parish just adds the missing node and moves nobody unexpectedly.

Options:

```
python manage.py derive_hierarchy --dry-run                 # build, report, roll back
python manage.py derive_hierarchy --region-name "Region 63" # the region to build under
```

### B. Build it explicitly (fresh install / new region)

With no user data to derive from, create nodes from a shell:

```python
from hierarchy import services
from hierarchy.models import NodeType

national = services.create_root('RCCG National')
region   = services.add_child(national, NodeType.REGION,   'Region 63')
prov9    = services.add_child(region,   NodeType.PROVINCE, 'Lagos Province 9')
zone     = services.add_child(prov9,    NodeType.ZONE,     'Zone 1')
area     = services.add_child(zone,     NodeType.AREA,     'Area A')
parish   = services.add_child(area,     NodeType.PARISH,   'Parish A')
```

`add_child` validates that the child type is legal under the parent (you cannot
hang a Parish directly off a Region), so a malformed tree fails at build time.

CSV bulk import of parishes is a documented V1 console feature
(`docs/07-feature-specifications.md` §3); until that ships, the shell above or a
one-off script is the path.

---

## The rule the tree must obey

Node types must nest in order: `national > region > province > zone > area >
parish`. `department` hangs off the appropriate unit. The service layer enforces
this; do not `INSERT` nodes directly.

## After building

Users need memberships (placed automatically by `derive_hierarchy`, manually via
`identity.authorization.set_membership` when building explicitly), and leaders need
role assignments — see [04 — RBAC bootstrap](04-rbac-bootstrap.md).

## Verification

```
python manage.py verify_deployment    # "hierarchy exists" and "memberships exist"
python manage.py grant_role --list     # prints the tree, indented, to eyeball it
```

- [ ] One national root, at least one region.
- [ ] `verify_deployment` shows `hierarchy exists: OK` and `memberships exist: OK`.
- [ ] The `derive_hierarchy` summary line shows the expected node / membership
      counts and an acceptable `unresolved` count.

## Moving a parish between areas

Re-scopes its members automatically (`docs/07` §3). Use `services.move_node(node,
new_parent)` — never re-point `path` by hand; treebeard maintains it.
