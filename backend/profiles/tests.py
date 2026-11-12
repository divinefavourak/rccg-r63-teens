import shutil
import tempfile
import unittest
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework.test import APITestCase

from users.models import User

from .models import TeenProfile

# Uploaded photos are written to the storage backend. Point the tests at a
# throwaway directory rather than the developer's media folder.
TEST_MEDIA_ROOT = tempfile.mkdtemp(prefix='faithtribe-avatar-tests-')
unittest.addModuleCleanup(shutil.rmtree, TEST_MEDIA_ROOT, ignore_errors=True)


def tiny_png(name='avatar.png'):
    """A real PNG, because ImageField validates the bytes, not the extension."""
    buffer = BytesIO()
    Image.new('RGB', (10, 10), 'red').save(buffer, 'PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')


class ProfileNameTests(APITestCase):
    """The teen's name reaches the app.

    `full_name` is read from `user.get_full_name`. The custom User model once
    lacked that method, and DRF quietly leaves a read-only field out when its
    source is missing, so every profile came back without a name.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='chife123456',
            email='chife@example.com',
            password='testpass123',
            first_name='Chife',
            last_name='Chinonso',
        )
        self.profile = TeenProfile.objects.create(user=self.user, gender='male')

    def test_my_profile_includes_full_name(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/v1/profiles/me/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['full_name'], 'Chife Chinonso')

    def test_profile_str_names_the_teen(self):
        # The admin list and logs call this; it used to raise AttributeError.
        self.assertEqual(str(self.profile), "Chife Chinonso's Profile")

    def test_full_name_with_only_a_first_name_has_no_trailing_space(self):
        self.user.last_name = ''
        self.assertEqual(self.user.get_full_name(), 'Chife')


class ProfileEditTests(APITestCase):
    """A teen can edit the details that describe them.

    The form in the app and on the website shows name and phone beside the
    teen fields, so the profile endpoint writes them to the account rather than
    making the client call two endpoints and risk saving half a form.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='editme', email='edit@example.com', password='testpass123',
            first_name='Old', last_name='Name', phone='+2348000000000',
        )
        TeenProfile.objects.create(user=self.user, gender='female', parish='Old Parish')

    def test_profile_shows_the_account_name_and_phone(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/v1/profiles/me/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['first_name'], 'Old')
        self.assertEqual(response.data['last_name'], 'Name')
        self.assertEqual(response.data['phone'], '+2348000000000')

    def test_patch_updates_name_phone_and_teen_fields_together(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            '/api/v1/profiles/me/',
            {
                'first_name': 'Ada',
                'last_name': 'Okafor',
                'phone': '+2348111111111',
                'bio': 'Loves the Psalms.',
                'parish': 'Grace Parish',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Ada')
        self.assertEqual(self.user.last_name, 'Okafor')
        self.assertEqual(self.user.phone, '+2348111111111')
        self.assertEqual(response.data['full_name'], 'Ada Okafor')
        self.assertEqual(response.data['bio'], 'Loves the Psalms.')
        self.assertEqual(response.data['parish'], 'Grace Parish')

    def test_date_of_birth_and_province_are_editable(self):
        # A teen knows their birthday and their province, and both are corrected
        # often. The age group is derived from the date by the model, never set
        # by the client.
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            '/api/v1/profiles/me/',
            {'date_of_birth': '2012-05-12', 'province': 'lagos_province_9'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.profile = TeenProfile.objects.get(user=self.user)
        self.assertEqual(str(self.profile.date_of_birth), '2012-05-12')
        self.assertEqual(self.profile.province, 'lagos_province_9')
        self.assertEqual(self.profile.age_group, 'teen')

    def test_gender_stays_out_of_the_teen_form(self):
        # Gender is a leader's correction; a self-service PATCH must not move it.
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            '/api/v1/profiles/me/',
            {'gender': 'male'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.profile = TeenProfile.objects.get(user=self.user)
        self.assertEqual(self.profile.gender, 'female')


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class ProfilePhotoTests(APITestCase):
    """One photo, whichever endpoint the client used.

    The app writes `TeenProfile.avatar`; the website and older tools write
    `User.profile_picture`. A photo set through one must appear through the
    other, or the same teen has two different faces depending on the screen.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='photo12345', email='photo@example.com', password='testpass123',
            first_name='Photo', last_name='Teen',
        )
        self.profile = TeenProfile.objects.create(user=self.user, gender='female')

    def test_app_avatar_is_mirrored_onto_the_account(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            '/api/v1/profiles/me/',
            {'avatar': tiny_png('app-avatar.png')},
            format='multipart',
        )

        self.assertEqual(response.status_code, 200)
        self.profile.refresh_from_db()
        self.user.refresh_from_db()
        self.assertTrue(self.profile.avatar.name)
        self.assertEqual(self.user.profile_picture.name, self.profile.avatar.name)

    def test_account_picture_is_mirrored_onto_the_profile(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            '/api/v1/auth/me/',
            {'profile_picture': tiny_png('web-avatar.png')},
            format='multipart',
        )

        self.assertEqual(response.status_code, 200)
        self.profile.refresh_from_db()
        self.user.refresh_from_db()
        self.assertTrue(self.user.profile_picture.name)
        self.assertEqual(self.profile.avatar.name, self.user.profile_picture.name)


class RepairProfileTests(APITestCase):
    """An account with a name and email but no profile row used to get a 404
    from `/profiles/me/`, which the app shows as "couldn't load your profile"."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testimony', email='testimony@example.com', password='x',
            first_name='Testimony', last_name='Adeleke',
            gender='female', parish='Grace Parish',
        )
        self.admin = User.objects.create_user(
            username='boss', email='boss@example.com', password='x',
            first_name='Boss', last_name='Admin', is_superuser=True,
        )

    def url(self, user):
        return f'/api/v1/profiles/repair/{user.pk}/'

    def test_my_profile_is_created_when_missing(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/v1/profiles/me/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['full_name'], 'Testimony Adeleke')
        self.assertEqual(response.data['user_email'], 'testimony@example.com')
        self.assertEqual(response.data['gender'], 'female')
        self.assertEqual(response.data['parish'], 'Grace Parish')

    def test_repair_creates_a_missing_profile(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url(self.user), {}, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['created'])
        self.assertEqual(response.data['profile']['parish'], 'Grace Parish')
        self.assertTrue(TeenProfile.objects.filter(user=self.user).exists())

    def test_repair_fills_blanks_and_keeps_what_is_there(self):
        TeenProfile.objects.create(user=self.user, gender='', guardian_name='Mum',
                                   parish='Own Parish', streak_days=4)
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url(self.user), {}, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['changed_fields'], ['gender'])
        profile = TeenProfile.objects.get(user=self.user)
        self.assertEqual(profile.gender, 'female')
        self.assertEqual(profile.parish, 'Own Parish')
        self.assertEqual(profile.guardian_name, 'Mum')

    def test_reset_clears_personal_details_and_keeps_stats(self):
        TeenProfile.objects.create(user=self.user, gender='male', guardian_name='Mum',
                                   allergies='Nuts', parish='Own Parish', streak_days=4)
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url(self.user), {'reset': True}, format='json')

        self.assertEqual(response.status_code, 200)
        profile = TeenProfile.objects.get(user=self.user)
        self.assertEqual(profile.gender, 'female')
        self.assertEqual(profile.parish, 'Grace Parish')
        self.assertEqual(profile.guardian_name, '')
        self.assertEqual(profile.allergies, '')
        self.assertEqual(profile.streak_days, 4)

    def test_repair_needs_the_manage_permission(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.url(self.user), {}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_command_creates_missing_profiles(self):
        from io import StringIO

        from django.core.management import call_command

        call_command('repair_profiles', '--apply', stdout=StringIO())
        self.assertTrue(TeenProfile.objects.filter(user=self.user).exists())

    def test_blank_account_gender_becomes_not_specified(self):
        self.user.gender = ''
        self.user.save()
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/v1/profiles/me/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['gender'], 'not_specified')

    def test_reset_deletes_the_stored_photo(self):
        from unittest import mock

        from django.core.files.base import ContentFile

        profile = TeenProfile.objects.create(user=self.user, gender='female')
        profile.avatar.save('face.png', ContentFile(b'x'), save=True)
        storage, name = profile.avatar.storage, profile.avatar.name
        self.client.force_authenticate(user=self.admin)
        with mock.patch.object(storage, 'delete') as delete, \
                self.captureOnCommitCallbacks(execute=True):
            self.client.post(self.url(self.user), {'reset': True}, format='json')

        delete.assert_called_once_with(name)
        self.assertFalse(TeenProfile.objects.get(user=self.user).avatar)
        storage.delete(name)
