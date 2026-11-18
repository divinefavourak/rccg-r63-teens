"""Everyone can change their own username, within the rules in users/usernames.py."""
from rest_framework.test import APITestCase

from profiles.models import TeenProfile
from users.models import User


class OwnUsernameTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username='ada482913', email='ada@example.com', password='x',
            first_name='Ada', last_name='Obi',
        )
        TeenProfile.objects.create(user=self.user, gender='female')
        User.objects.create_user(username='tolu', email='tolu@example.com', password='x')
        self.client.force_authenticate(self.user)

    def profile(self, **body):
        return self.client.patch('/api/v1/profiles/me/', body, format='json')

    def test_a_teen_changes_theirs_from_the_profile_screen(self):
        response = self.profile(username='ada.obi')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['user_username'], 'ada.obi')
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'ada.obi')

    def test_and_from_the_website_account_form(self):
        response = self.client.patch('/api/v1/auth/me/', {'username': 'ada_o'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'ada_o')

    def test_saving_the_form_unchanged_is_fine(self):
        # The app sends the whole form, username included, on every save.
        self.assertEqual(self.profile(username='ada482913', bio='Hi').status_code, 200)

    def test_someone_else_s_in_other_capitals_is_refused(self):
        response = self.profile(username='TOLU')
        self.assertEqual(response.status_code, 400)
        self.assertIn('username', response.data)

    def test_staff_sounding_names_are_refused(self):
        for name in ('admin', 'FaithTribe', 'support'):
            response = self.profile(username=name)
            self.assertEqual(response.status_code, 400, name)

    def test_the_shape_rules_apply(self):
        self.assertEqual(self.profile(username='ad').status_code, 400)
        self.assertEqual(self.profile(username='ada obi').status_code, 400)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'ada482913')
