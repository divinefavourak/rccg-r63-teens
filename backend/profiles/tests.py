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
