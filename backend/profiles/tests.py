from rest_framework.test import APITestCase

from users.models import User

from .models import TeenProfile


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
