"""
Backfill a primary `MemoryVerse` for every devotional whose verse lives only in
the legacy `memory_verse_passage` / `memory_verse_content` fields.

Without one, the review gate refuses to approve or publish the devotional
("A devotional cannot be published without a primary memory verse"), and a
published day has no Verse of the Day. Mirrors
`content.services.daily.ensure_primary_memory_verse`.
"""
from django.db import migrations


def backfill(apps, schema_editor):
    Devotional = apps.get_model('content', 'Devotional')
    MemoryVerse = apps.get_model('content', 'MemoryVerse')

    missing = (
        Devotional.objects
        .exclude(memory_verses__is_primary=True)
        .exclude(memory_verse_passage='')
        .exclude(memory_verse_content='')
    )
    MemoryVerse.objects.bulk_create([
        MemoryVerse(
            devotional=devotional,
            is_primary=True,
            reference_display=devotional.memory_verse_passage.strip()[:255],
            text_override=devotional.memory_verse_content.strip(),
        )
        for devotional in missing.iterator()
        if devotional.memory_verse_passage.strip() and devotional.memory_verse_content.strip()
    ])


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0008_alter_article_cover_image'),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
