"""
Step 2 of 3: carry each event's audience from `target_provinces` into `scope_node`.

The mapping, and the reasoning for each case:

* **empty list** -> NULL. The old default meant "all provinces". NULL means
  "unscoped, visible everywhere". Same meaning, no hard-coded names.
* **exactly one province** -> that province's `HierarchyNode`. The common case, and
  a lossless translation.
* **several provinces** -> the region node. A single FK cannot express "provinces 9
  and 28 but not 69", so the audience *widens* to the region. This is a real
  semantic change and it is chosen deliberately: widening the visibility of an
  already-published event is recoverable (a coordinator re-narrows it), whereas
  narrowing or nulling one silently hides an event teens are already registering
  for. Every such event is printed during the migration so a human can re-scope it.
* **a province name we cannot resolve to a node** -> NULL, and printed. Fails open
  on visibility, loudly.

Province strings map to nodes by the label `identity/management/commands/
derive_hierarchy.py` used when it built the tree in Phase 1 ('lagos_province_9' ->
'Lagos Province 9'), so the two commands agree on what a province node is called.
"""
from django.db import migrations

# The legacy enum, frozen here as data. Migrations must not import
# common.models.Province: the whole point of this change is that the enum goes
# away, and a migration that imports it would break the moment it does.
LEGACY_PROVINCE_LABELS = {
    'lagos_province_9': 'Lagos Province 9',
    'lagos_province_28': 'Lagos Province 28',
    'lagos_province_69': 'Lagos Province 69',
    'lagos_province_84': 'Lagos Province 84',
    'lagos_province_86': 'Lagos Province 86',
    'lagos_province_104': 'Lagos Province 104',
    'regional_hq': 'Regional Headquarter',
}


def forwards(apps, schema_editor):
    Event = apps.get_model('events', 'Event')
    HierarchyNode = apps.get_model('hierarchy', 'HierarchyNode')

    events = list(Event.objects.exclude(target_provinces=[]))
    if not events:
        return

    # The region is the fallback scope for anything we cannot pin to one province.
    # If the tree has not been built yet (a fresh database), there is nothing to
    # resolve against and every event stays NULL — visible everywhere, which is
    # exactly what an unmigrated event meant.
    region = HierarchyNode.objects.filter(node_type='region').order_by('path').first()

    nodes_by_name = {
        node.name: node
        for node in HierarchyNode.objects.filter(node_type='province')
    }

    widened, unresolved = [], []

    for event in events:
        provinces = [p for p in (event.target_provinces or []) if p]

        resolved = []
        for province in provinces:
            label = LEGACY_PROVINCE_LABELS.get(province, province)
            node = nodes_by_name.get(label)
            if node is None:
                unresolved.append((event.title, province))
            else:
                resolved.append(node)

        if len(resolved) == 1 and len(provinces) == 1:
            event.scope_node = resolved[0]
        elif resolved:
            # Several provinces, or a partial resolution: widen to the region.
            event.scope_node = region
            widened.append((event.title, provinces))
        else:
            event.scope_node = None      # unresolved -> unscoped, fail open

        event.save(update_fields=['scope_node'])

    for title, provinces in widened:
        print(f'  events: widened "{title}" to the region '
              f'(targeted {len(provinces)} provinces: {", ".join(provinces)}) — '
              f're-scope it in the console if it should be narrower.')
    for title, province in unresolved:
        print(f'  events: could not resolve province {province!r} for "{title}"; '
              f'it is now visible everywhere.')


def backwards(apps, schema_editor):
    """
    Irreversible in the strict sense — a single node cannot reconstruct the exact
    province list a widened event used to carry. We restore what *can* be restored
    (the single-province case) rather than refusing to reverse at all, so a rollback
    is possible in an incident.
    """
    Event = apps.get_model('events', 'Event')

    reverse_labels = {v: k for k, v in LEGACY_PROVINCE_LABELS.items()}

    for event in Event.objects.exclude(scope_node__isnull=True).select_related('scope_node'):
        node = event.scope_node
        if node.node_type != 'province':
            continue
        legacy = reverse_labels.get(node.name)
        if legacy:
            event.target_provinces = [legacy]
            event.save(update_fields=['target_provinces'])


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0006_add_event_scope_node'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
