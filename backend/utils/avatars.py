"""
Avatar utility — Open Peeps via DiceBear.

DiceBear's open-peeps style (https://www.dicebear.com/styles/open-peeps/) is used
as the fallback avatar generator. It always returns a PNG, ensuring email-client
compatibility (Gmail and Outlook strip SVG).

Gender differentiation is achieved by:
  - Restricting the `head[]` pool to feminine or masculine styles
  - Setting `facialHairProbability` to 0 for female avatars
"""
from urllib.parse import quote

_BASE = 'https://api.dicebear.com/8.x/open-peeps/png'

# Head values available in DiceBear open-peeps, split by typical gender presentation
_FEMALE_HEADS = ['bun', 'long', 'hijab', 'turban', 'afro']
_MALE_HEADS   = ['short', 'curly', 'buzzcut', 'faded']


def _head_params(heads: list) -> str:
    return '&'.join(f'head[]={h}' for h in heads)


def get_peep_url(seed: str, gender: str = '', size: int = 100) -> str:
    """
    Return a DiceBear Open Peeps PNG URL for use in email templates.

    Args:
        seed:   Unique, stable value that determines which avatar is shown
                (use username or attendee name for consistency across sends).
        gender: 'male' | 'female' | '' (neutral / not specified)
        size:   Pixel dimensions of the square avatar image.

    Returns:
        Absolute URL string to a PNG image.

    Examples:
        get_peep_url('john_doe', 'male')    → masculine-looking peep
        get_peep_url('jane_doe', 'female')  → feminine-looking peep
        get_peep_url('alex')                → random-but-consistent peep
    """
    g = (gender or '').strip().lower()

    parts = [
        f'seed={quote(str(seed))}',
        f'size={size}',
    ]

    if g in ('female', 'f', 'girl', 'woman'):
        parts.append(_head_params(_FEMALE_HEADS))
        parts.append('facialHairProbability=0')
    elif g in ('male', 'm', 'boy', 'man'):
        parts.append(_head_params(_MALE_HEADS))
        parts.append('facialHairProbability=60')
    # neutral / not_specified → no restrictions, DiceBear picks based on seed

    return f'{_BASE}?{"&".join(parts)}'


def get_user_avatar(user, size: int = 100) -> str:
    """
    Resolve the best available avatar URL for a User instance.

    Priority:
        1. TeenProfile.avatar      (uploaded image)
        2. User.profile_picture    (uploaded image)
        3. DiceBear Open Peeps     (gender from TeenProfile if present)

    Args:
        user: User model instance
        size: Pixel size for the DiceBear fallback

    Returns:
        Absolute URL string
    """
    # Gender resolution order: User.gender → TeenProfile.gender → ''
    gender = getattr(user, 'gender', '') or ''

    # 1 — TeenProfile uploaded avatar
    try:
        profile = user.teen_profile
        if profile.avatar:
            return profile.avatar.url
        if not gender:
            gender = profile.gender or ''
    except Exception:
        pass

    # 2 — User profile picture
    if getattr(user, 'profile_picture', None):
        try:
            return user.profile_picture.url
        except Exception:
            pass

    # 3 — DiceBear fallback, gender-aware
    return get_peep_url(seed=user.username, gender=gender, size=size)


def get_registration_avatar(registration, size: int = 100) -> str:
    """
    Resolve an avatar URL for an EventRegistration attendee.
    Attendees may not have user accounts, so always falls back to DiceBear.

    Args:
        registration: EventRegistration model instance
        size:         Pixel size for the DiceBear image

    Returns:
        Absolute URL string
    """
    return get_peep_url(
        seed=registration.attendee_name,
        gender=getattr(registration, 'attendee_gender', ''),
        size=size,
    )
