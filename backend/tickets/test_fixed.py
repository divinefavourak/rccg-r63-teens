"""
Fixed tests that should pass
"""
from django.test import TestCase
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from users.models import User
from tickets.models import Ticket, BulkUpload
import csv
import io

class FixedTicketTest(TestCase):
    """Fixed ticket tests."""
    
    def setUp(self):
        self.coordinator = User.objects.create_user(
            username='coordinator',
            password='password123',
            name='Coordinator',
            role=User.Role.COORDINATOR,
            province='TEST PROVINCE'
        )
        
        self.admin = User.objects.create_user(
            username='admin',
            password='password123',
            name='Admin',
            role=User.Role.ADMIN
        )
    
    def test_create_ticket_simple(self):
        """Simple ticket creation test."""
        ticket = Ticket.objects.create(
            full_name='Simple Test',
            age=15,
            category=Ticket.Category.TEENS,
            gender=Ticket.Gender.MALE,
            phone='1111111111',
            email='simple@test.com',
            province='TEST PROVINCE',
            zone='Zone 1',
            area='Area 1',
            parish='Parish 1',
            emergency_contact='Emergency',
            emergency_phone='2222222222',
            emergency_relationship='Parent',
            parent_name='Parent',
            parent_email='parent@test.com',
            parent_phone='2222222222',
            parent_relationship='Parent',
            registered_by=self.coordinator
        )
        
        self.assertIsNotNone(ticket.ticket_id)
        self.assertEqual(ticket.status, 'pending')
        self.assertEqual(ticket.full_name, 'Simple Test')
    
    def test_ticket_api_create(self):
        """Test ticket creation via API."""
        client = APIClient()
        client.force_authenticate(user=self.coordinator)
        
        data = {
            'full_name': 'API Test',
            'age': 16,
            'category': 'teens',
            'gender': 'male',
            'phone': '3333333333',
            'email': 'api@test.com',
            'province': 'TEST PROVINCE',
            'zone': 'Zone 1',
            'area': 'Area 1',
            'parish': 'Parish 1',
            'emergency_contact': 'Emergency',
            'emergency_phone': '4444444444',
            'emergency_relationship': 'Parent',
            'parent_name': 'Parent',
            'parent_email': 'parent@test.com',
            'parent_phone': '4444444444',
            'parent_relationship': 'Parent'
        }
        
        response = client.post(reverse('ticket-list'), data, format='json')
        
        # Check response
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['full_name'], 'API Test')
        self.assertEqual(response.data['status'], 'pending')
        
        # Check ticket was created
        ticket = Ticket.objects.get(full_name='API Test')
        self.assertEqual(ticket.registered_by, self.coordinator)
    
    def test_bulk_upload_simple(self):
        """Simple bulk upload test."""
        from tickets.services import BulkUploadService
        
        # Create CSV content
        csv_content = """Full Name,Age,Gender,Phone,Email,Province,Zone,Area,Parish,Emergency Contact,Emergency Phone,Emergency Relationship,Parent Name,Parent Email,Parent Phone,Parent Relationship
John Doe,15,Male,1234567890,john@test.com,TEST PROVINCE,Zone A,Area 1,Parish 1,Jane Doe,0987654321,Mother,Jane Doe,jane@test.com,0987654321,Mother
Jane Smith,12,Female,2345678901,jane@test.com,TEST PROVINCE,Zone B,Area 2,Parish 2,John Smith,9876543210,Father,John Smith,john.smith@test.com,9876543210,Father"""
        
        csv_file = SimpleUploadedFile(
            "test.csv",
            csv_content.encode('utf-8'),
            content_type="text/csv"
        )
        
        # Process CSV
        result = BulkUploadService.process_csv_file(csv_file, self.coordinator)
        
        # Check results
        self.assertEqual(result['total'], 2)
        self.assertEqual(result['successful'], 2)
        self.assertEqual(result['failed'], 0)
        
        # Check tickets were created
        tickets = Ticket.objects.all()
        self.assertEqual(tickets.count(), 2)
        
        # Check first ticket
        john_ticket = Ticket.objects.get(full_name='John Doe')
        self.assertEqual(john_ticket.age, 15)
        self.assertEqual(john_ticket.gender, 'male')
        self.assertEqual(john_ticket.registered_by, self.coordinator)
    
    def test_dashboard_stats(self):
        """Test dashboard statistics."""
        from tickets.services import DashboardService
        
        # Create some tickets
        for i in range(3):
            Ticket.objects.create(
                full_name=f'Person {i}',
                age=15,
                category=Ticket.Category.TEENS,
                gender=Ticket.Gender.MALE,
                phone=f'123456789{i}',
                email=f'person{i}@test.com',
                province='TEST PROVINCE',
                zone=f'Zone {i}',
                area=f'Area {i}',
                parish=f'Parish {i}',
                emergency_contact='Emergency',
                emergency_phone='0987654321',
                emergency_relationship='Parent',
                parent_name='Parent',
                parent_email='parent@test.com',
                parent_phone='0987654321',
                parent_relationship='Parent',
                status=Ticket.Status.APPROVED if i < 2 else Ticket.Status.PENDING,
                registered_by=self.coordinator
            )
        
        # Test coordinator stats
        coordinator_stats = DashboardService.get_coordinator_stats(self.coordinator)
        self.assertEqual(coordinator_stats['stats']['total_tickets'], 3)
        self.assertEqual(coordinator_stats['stats']['approved_tickets'], 2)
        self.assertEqual(coordinator_stats['stats']['pending_tickets'], 1)
        
        # Test admin stats
        admin_stats = DashboardService.get_admin_stats()
        self.assertEqual(admin_stats['global_stats']['total_tickets'], 3)
        self.assertEqual(len(admin_stats['province_stats']), 1)  # One province