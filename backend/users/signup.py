"""
Passwordless sign-up.

A teen gives a name, an email address and a phone number, gets one code sent to
both, and types it in. No password is ever set: afterwards they sign in with a
fresh code through ``/auth/otp/request/`` and ``/auth/otp/verify/``.

Two endpoints, deliberately separate from ``/auth/otp/request/``:

- ``POST /auth/signup/start/``    send the code.
- ``POST /auth/signup/complete/`` check it, create the account, return tokens.

``/auth/otp/request/`` only ever sends to a destination that already belongs to
an account, which is what stops it being a free SMS and email relay. Sign-up
cannot have that property — its whole job is to reach somebody with no account
— so the abuse controls live here instead: a per-IP throttle, and a cap on how
many codes any one address or number can be sent.

Neither endpoint reveals whether an email or phone is already registered. If it
is, ``start`` quietly sends that account a *login* code, and ``complete`` signs
them in with it.
"""
import logging
import re
import secrets

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils.text import slugify
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .email_service import UserEmailService
from .models import OTPCode
from .otp import consume_outstanding, generate_code, request_otp, verify_otp

logger = logging.getLogger(__name__)
User = get_user_model()

_GENERIC_START = {'detail': 'If those details are valid, a code is on its way.'}
_BAD_CODE = {'detail': 'That code is wrong or has expired.'}


# ─── Normalisation ──────────────────────────────────────────────────────────

def normalize_email(value):
    return (value or '').strip().lower()


def normalize_phone(value):
    """Return the number in ``+<country><number>`` form, or '' if it is not one.

    Nigerian numbers arrive as ``0803…``, ``803…``, ``234803…`` or
    ``+234803…``; all four are the same phone and must match the same account.
    Anything already carrying a ``+`` is trusted as international.
    """
    raw = re.sub(r'[\s\-().]', '', value or '')
    if not raw:
        return ''
    if raw.startswith('+'):
        digits = raw[1:]
    elif raw.startswith('234') and len(raw) == 13:
        digits = raw
    elif raw.startswith('0') and len(raw) == 11:
        digits = '234' + raw[1:]
    elif len(raw) == 10 and raw[0] in '789':
        digits = '234' + raw
    else:
        return ''
    if not digits.isdigit() or not 9 <= len(digits) <= 15:
        return ''
    return '+' + digits


def _phone_variants(phone):
    """Every form an existing account may have stored this number in.

    Older accounts typed their phone into a free-text field, so the same number
    may be on file as ``0803…`` or ``+234803…``.
    """
    variants = {phone, phone.lstrip('+')}
    if phone.startswith('+234'):
        variants.add('0' + phone[4:])
    return variants


def find_by_phone(value, active_only=True):
    """The account holding this phone number, in whatever form it was stored."""
    phone = normalize_phone(value)
    candidates = _phone_variants(phone) if phone else {(value or '').strip()}
    candidates.discard('')
    if not candidates:
        return None
    users = User.objects.filter(phone__in=candidates)
    if active_only:
        users = users.filter(is_active=True)
    return users.first()


def find_account(email, phone):
    """The existing active account for this email, else for this phone."""
    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if user:
        return user, email, OTPCode.Channel.EMAIL
    user = find_by_phone(phone)
    if user:
        return user, phone, OTPCode.Channel.SMS
    return None, None, None


# ─── Abuse control ──────────────────────────────────────────────────────────

def _allow_code_for(destination):
    """Count a send against ``destination``; False once it is over the cap."""
    limit = int(getattr(settings, 'SIGNUP_CODES_PER_DESTINATION', 3))
    window = int(getattr(settings, 'SIGNUP_CODE_WINDOW_SECONDS', 600))
    key = f'signup:sent:{destination}'
    # add() is a no-op when the key exists, so the window starts at the first
    # send and is not pushed back by later ones.
    cache.add(key, 0, window)
    try:
        return cache.incr(key) <= limit
    except ValueError:
        # Expired between add() and incr(); treat as the first send.
        cache.set(key, 1, window)
        return True


# ─── Serializers ────────────────────────────────────────────────────────────

class _ContactSerializer(serializers.Serializer):
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=32)

    def validate_email(self, value):
        return normalize_email(value)

    def validate_phone(self, value):
        phone = normalize_phone(value)
        if not phone:
            raise serializers.ValidationError('Enter a valid phone number.')
        return phone


class SignupCompleteSerializer(_ContactSerializer):
    code = serializers.CharField(max_length=12)
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    gender = serializers.ChoiceField(
        choices=User.Gender.choices, required=False, allow_blank=True,
    )
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    # The deepest hierarchy node the teen picked — normally a parish, but any
    # level is accepted for "I am not sure of my parish".
    church_node = serializers.UUIDField(required=False, allow_null=True)

    def validate_code(self, value):
        return value.strip()

    def validate_church_node(self, value):
        if value is None:
            return None
        from hierarchy.models import HierarchyNode
        node = HierarchyNode.objects.filter(pk=value, is_active=True).first()
        if node is None:
            raise serializers.ValidationError('That church could not be found.')
        return node


# ─── Views ──────────────────────────────────────────────────────────────────

class SignupStartView(APIView):
    """Send one code to both the email address and the phone number."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = 'signup'

    def post(self, request):
        serializer = _ContactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        phone = serializer.validated_data['phone']

        # Checked before anything is sent, and answered with the same body as a
        # success so the cap itself reveals nothing.
        allowed = [_allow_code_for(email), _allow_code_for(phone)]
        if not all(allowed):
            return Response(_GENERIC_START)

        user, destination, channel = find_account(email, phone)
        if user is not None:
            # Already registered: send that account a login code instead. The
            # response is identical, so nothing is disclosed to the caller.
            request_otp(destination, channel, OTPCode.Purpose.LOGIN, user=user)
            return Response(_GENERIC_START)

        code = generate_code()
        request_otp(email, OTPCode.Channel.EMAIL, OTPCode.Purpose.VERIFY, code=code)
        request_otp(phone, OTPCode.Channel.SMS, OTPCode.Purpose.VERIFY, code=code)
        return Response(_GENERIC_START)


class SignupCompleteView(APIView):
    """Check the code, create the account and sign the teen in."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = 'signup'

    def post(self, request):
        from .views import otp_login_response  # avoids a circular import

        serializer = SignupCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        email, phone, code = data['email'], data['phone'], data['code']

        # An address or number that already had an account was sent a login
        # code by `start`; honour it here so the teen is simply signed in.
        existing, destination, _ = find_account(email, phone)
        if existing is not None:
            otp = verify_otp(destination, OTPCode.Purpose.LOGIN, code)
            if otp is None:
                return Response(_BAD_CODE, status=status.HTTP_400_BAD_REQUEST)
            return otp_login_response(existing, otp)

        # Either copy of the code will do. Whichever matched, the other is
        # retired so it cannot be used a second time.
        otp = verify_otp(email, OTPCode.Purpose.VERIFY, code)
        if otp is not None:
            consume_outstanding(phone, OTPCode.Purpose.VERIFY)
        else:
            otp = verify_otp(phone, OTPCode.Purpose.VERIFY, code)
            if otp is not None:
                consume_outstanding(email, OTPCode.Purpose.VERIFY)
        if otp is None:
            return Response(_BAD_CODE, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                user = _create_teen(data)
        except IntegrityError:
            # Two requests raced for the same email; the other one won.
            return Response(
                {'detail': 'An account with these details already exists. Try signing in.'},
                status=status.HTTP_409_CONFLICT,
            )

        UserEmailService.send_welcome_email(user)
        response = otp_login_response(user, otp)
        response.status_code = status.HTTP_201_CREATED
        return response


# ─── Account creation ───────────────────────────────────────────────────────

def _unique_username(first_name):
    """A readable, unique handle. The teen never types it: they sign in by code."""
    base = slugify(first_name)[:20] or 'teen'
    for _ in range(8):
        candidate = f'{base}{secrets.randbelow(10 ** 6):06d}'
        if not User.objects.filter(username=candidate).exists():
            return candidate
    return f'{base}{secrets.token_hex(6)}'


def _church_fields(node):
    """Names for the legacy free-text church fields, from the chosen node up.

    Returns ``(fields, province_choice)``. ``province`` on User and TeenProfile
    is a choices field, so it is only filled when the node's name is one of
    those choices; a region added later simply leaves it blank.
    """
    from hierarchy.models import NodeType

    fields = {'zone': '', 'area': '', 'parish': ''}
    province = None
    if node is None:
        return fields, province

    labels = {label.lower(): value for value, label in User.Province.choices}
    for step in [*node.get_ancestors(), node]:
        if step.node_type == NodeType.PROVINCE:
            province = labels.get(step.name.strip().lower())
        elif step.node_type in (NodeType.ZONE, NodeType.AREA, NodeType.PARISH):
            fields[step.node_type] = step.name[:100]
    return fields, province


def _create_teen(data):
    from identity.models import Membership
    from profiles.models import TeenProfile

    node = data.get('church_node')
    church, province = _church_fields(node)
    gender = data.get('gender') or ''

    user = User(
        username=_unique_username(data['first_name']),
        email=data['email'],
        phone=data['phone'],
        first_name=data['first_name'].strip(),
        last_name=data['last_name'].strip(),
        gender=gender,
        role=User.Role.TEEN,
        province=province,
        # The code proved the teen controls the email or the phone.
        is_verified=True,
        **church,
    )
    # No password exists to guess, reset or leak; sign-in is by code only.
    user.set_unusable_password()
    user.save()

    TeenProfile.objects.create(
        user=user,
        date_of_birth=data.get('date_of_birth'),
        gender=gender,
        province=province or '',
        guardian_name='',
        guardian_phone='',
        guardian_email='',
        guardian_relationship='',
        **church,
    )

    if node is not None:
        Membership.objects.create(user=user, organization_node=node, is_primary=True)

    logger.info('[Signup] account created user=%s node=%s', user.username, node and node.pk)
    return user
