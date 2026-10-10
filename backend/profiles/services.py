"""
Repairing teen profiles that are missing or incomplete.

Every account is meant to have a TeenProfile, but some never got one: the old
register view swallowed errors while creating it, and accounts made in the
admin or the Console skip it. Without one, `/profiles/me/` answers 404 and the
app says it couldn't load the profile, even though the account itself has a
name and an email.
"""
import logging

from django.db import transaction

from .models import TeenProfile

logger = logging.getLogger(__name__)

# Fields the account already knows, copied onto the profile when it lacks them.
_FROM_ACCOUNT = ('gender', 'province', 'zone', 'area', 'parish')

# Fields the teen fills in themselves. A reset empties them.
_PERSONAL = (
    'bio', 'department',
    'guardian_name', 'guardian_phone', 'guardian_email', 'guardian_relationship',
    'emergency_contact_name', 'emergency_contact_phone',
    'emergency_contact_relationship',
    'medical_conditions', 'allergies', 'medications', 'dietary_restrictions',
    'blood_group',
)


def _delete_file(storage, name):
    """Remove a cleared photo from storage. A failure only leaves a stray file."""
    try:
        storage.delete(name)
    except Exception:
        logger.warning('[Profiles] could not delete %s', name, exc_info=True)


def _account_values(user):
    """Profile field values taken from the account and its primary church."""
    values = {
        'gender': user.gender or '',
        'province': user.province or '',
        'zone': user.zone or '',
        'area': user.area or '',
        'parish': user.parish or '',
    }

    # The church node the teen joined is newer and more exact than the
    # free-text fields on the account, so it wins where it names something.
    membership = (
        user.memberships.filter(is_primary=True, is_active=True)
        .select_related('organization_node').first()
    )
    if membership is not None:
        from users.signup import _church_fields

        church, province = _church_fields(membership.organization_node)
        values.update({k: v for k, v in church.items() if v})
        if province:
            values['province'] = province
    return values


@transaction.atomic
def repair_profile(user, reset=False):
    """Give ``user`` a complete profile.

    Creates the profile when it is missing and fills any blank field the
    account can supply. With ``reset``, also clears what the teen typed in
    (guardian, emergency, medical, bio) and the photo, and takes every
    account-backed field afresh. Streaks, counts, saved items and reading
    progress are kept either way.

    Returns ``(profile, created, changed_fields)``.
    """
    from_account = _account_values(user)

    # TeenProfile.gender has no blank choice, though User.gender may be blank.
    profile, created = TeenProfile.objects.select_for_update().get_or_create(
        user=user,
        defaults={**from_account,
                  'gender': from_account['gender'] or TeenProfile.Gender.NOT_SPECIFIED},
    )
    if created:
        return profile, True, sorted(k for k, v in from_account.items() if v or k == 'gender')

    changed = []
    for field in _FROM_ACCOUNT:
        value = from_account[field]
        current = getattr(profile, field)
        if value and current != value and (reset or not current):
            setattr(profile, field, value)
            changed.append(field)
    if not profile.gender:
        profile.gender = TeenProfile.Gender.NOT_SPECIFIED
        changed.append('gender')

    if reset:
        for field in _PERSONAL:
            if getattr(profile, field):
                setattr(profile, field, '')
                changed.append(field)
        if profile.avatar:
            # Clearing the field leaves the file behind; remove it once the
            # reset has committed, so a rollback keeps the photo it points at.
            storage, name = profile.avatar.storage, profile.avatar.name
            profile.avatar = None
            changed.append('avatar')
            transaction.on_commit(lambda: _delete_file(storage, name))
        for field, empty in (('favorite_devotional_topics', []),
                             ('notification_preferences', {})):
            if getattr(profile, field):
                setattr(profile, field, empty)
                changed.append(field)

    if changed:
        # age_group is recomputed by save() from date_of_birth.
        profile.save()
    return profile, False, sorted(changed)
