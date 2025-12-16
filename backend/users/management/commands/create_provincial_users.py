"""
Django management command to create provincial coordinator accounts
Usage: python manage.py create_provincial_users
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
import secrets
import string

User = get_user_model()


class Command(BaseCommand):
    help = 'Creates provincial coordinator user accounts with secure passwords'

    def generate_password(self, length=16):
        """Generate a secure random password"""
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        password = ''.join(secrets.choice(alphabet) for _ in range(length))
        return password

    def handle(self, *args, **options):
        # Define provincial coordinators
        provinces = [
            {
                'province': User.Province.LAGOS_PROVINCE_9,
                'username': 'lagos_province_9',
                'email': 'province9@r63teens.com',
                'first_name': 'Province',
                'last_name': '9 Coordinator',
            },
            {
                'province': User.Province.LAGOS_PROVINCE_28,
                'username': 'lagos_province_28',
                'email': 'province28@r63teens.com',
                'first_name': 'Province',
                'last_name': '28 Coordinator',
            },
            {
                'province': User.Province.LAGOS_PROVINCE_69,
                'username': 'lagos_province_69',
                'email': 'province69@r63teens.com',
                'first_name': 'Province',
                'last_name': '69 Coordinator',
            },
            {
                'province': User.Province.LAGOS_PROVINCE_84,
                'username': 'lagos_province_84',
                'email': 'province84@r63teens.com',
                'first_name': 'Province',
                'last_name': '84 Coordinator',
            },
            {
                'province': User.Province.LAGOS_PROVINCE_86,
                'username': 'lagos_province_86',
                'email': 'province86@r63teens.com',
                'first_name': 'Province',
                'last_name': '86 Coordinator',
            },
            {
                'province': User.Province.LAGOS_PROVINCE_104,
                'username': 'lagos_province_104',
                'email': 'province104@r63teens.com',
                'first_name': 'Province',
                'last_name': '104 Coordinator',
            },
            {
                'province': User.Province.REGIONAL_HQ,
                'username': 'regional_hq',
                'email': 'regional.hq@r63teens.com',
                'first_name': 'Regional',
                'last_name': 'Headquarter',
            },
        ]

        credentials = []
        self.stdout.write(self.style.SUCCESS('\n=== Creating Provincial Coordinator Accounts ===\n'))

        for province_data in provinces:
            username = province_data['username']
            
            # Check if user already exists
            if User.objects.filter(username=username).exists():
                self.stdout.write(
                    self.style.WARNING(f'User {username} already exists. Skipping...')
                )
                continue

            # Generate secure password
            password = self.generate_password()

            # Create user
            user = User.objects.create_user(
                username=username,
                email=province_data['email'],
                password=password,
                first_name=province_data['first_name'],
                last_name=province_data['last_name'],
                role=User.Role.COORDINATOR,
                province=province_data['province'],
                phone='+2348000000000',  # Placeholder
                is_active=True,
            )

            credentials.append({
                'province': province_data['province'].label,
                'username': username,
                'password': password,
                'email': province_data['email'],
            })

            self.stdout.write(
                self.style.SUCCESS(f'+ Created: {username} ({province_data["province"].label})')
            )

        # Display credentials summary
        self.stdout.write(self.style.SUCCESS('\n=== LOGIN CREDENTIALS ===\n'))
        self.stdout.write(self.style.WARNING('IMPORTANT: Save these credentials securely!\n'))
        
        for cred in credentials:
            self.stdout.write(f"\n{cred['province']}:")
            self.stdout.write(f"  Username: {cred['username']}")
            self.stdout.write(f"  Password: {cred['password']}")
            self.stdout.write(f"  Email:    {cred['email']}")

        self.stdout.write(self.style.SUCCESS(f'\n\nSuccessfully created {len(credentials)} coordinator accounts!'))
        self.stdout.write(self.style.WARNING('\nREMINDER: These passwords will not be shown again. Save them securely!'))
