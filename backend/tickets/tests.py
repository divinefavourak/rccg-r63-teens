import os
import tempfile
import csv
from io import StringIO
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from users.models import User
from tickets.models import Ticket, BulkUpload
from tickets.services import TicketService, BulkUploadService, DashboardService


class TicketModelTest(TestCase):
    """Test cases for Ticket model."""
    
    def setUp(self):
        self.admin_user = User.objects.create_user(
            username='admin',
            password='adminpass123',
            name='Admin User',
            email='admin@test.com',
            role=User.Role.ADMIN
        )
        
        self.coordinator_user = User.objects.create_user(
            username='coordinator',
            password='coordpass123',
            name='Coordinator User',
            email='coordinator@test.com',
            role=User.Role.COORDINATOR,
            province='Test Province'
        )
        
        # Don't use dictionary unpacking - create tickets directly
        self.ticket_data = {
            'full_name': 'John Doe',
            'age': 15,
            'category': Ticket.Category.TEENS,
            'gender': Ticket.Gender.MALE,
            'phone': '1234567890',
            'email': 'john@test.com',
            'province': 'Test Province',
            'zone': 'Zone A',
            'area': 'Area 1',
            'parish': 'Test Parish',
            'department': 'Music',
            'medical_conditions': 'None',
            'medications': 'None',
            'dietary_restrictions': 'Vegetarian',
            'emergency_contact': 'Jane Doe',
            'emergency_phone': '0987654321',
            'emergency_relationship': 'Mother',
            'parent_name': 'Jane Doe',
            'parent_email': 'jane@test.com',
            'parent_phone': '0987654321',
            'parent_relationship': 'Mother',
        }
    
    def test_ticket_creation(self):
        """Test creating a ticket."""
        ticket = Ticket.objects.create(
            full_name=self.ticket_data['full_name'],
            age=self.ticket_data['age'],
            category=self.ticket_data['category'],
            gender=self.ticket_data['gender'],
            phone=self.ticket_data['phone'],
            email=self.ticket_data['email'],
            province=self.ticket_data['province'],
            zone=self.ticket_data['zone'],
            area=self.ticket_data['area'],
            parish=self.ticket_data['parish'],
            department=self.ticket_data['department'],
            medical_conditions=self.ticket_data['medical_conditions'],
            medications=self.ticket_data['medications'],
            dietary_restrictions=self.ticket_data['dietary_restrictions'],
            emergency_contact=self.ticket_data['emergency_contact'],
            emergency_phone=self.ticket_data['emergency_phone'],
            emergency_relationship=self.ticket_data['emergency_relationship'],
            parent_name=self.ticket_data['parent_name'],
            parent_email=self.ticket_data['parent_email'],
            parent_phone=self.ticket_data['parent_phone'],
            parent_relationship=self.ticket_data['parent_relationship'],
            registered_by=self.coordinator_user
        )
        
        self.assertIsNotNone(ticket.ticket_id)
        self.assertTrue(ticket.ticket_id.startswith('R63-'))
        self.assertEqual(ticket.status, Ticket.Status.PENDING)
        self.assertEqual(ticket.full_name, 'John Doe')
        self.assertEqual(ticket.age, 15)
        self.assertEqual(ticket.category, Ticket.Category.TEENS)
        self.assertEqual(ticket.registered_by, self.coordinator_user)
        self.assertIsNotNone(ticket.registered_at)
    
    def test_ticket_id_generation(self):
        """Test that ticket IDs are generated correctly and sequentially."""
        ticket1 = Ticket.objects.create(
            full_name='John Doe',
            age=15,
            category=Ticket.Category.TEENS,
            gender=Ticket.Gender.MALE,
            phone='1234567890',
            email='john@test.com',
            province='Test Province',
            zone='Zone A',
            area='Area 1',
            parish='Test Parish',
            emergency_contact='Jane Doe',
            emergency_phone='0987654321',
            emergency_relationship='Mother',
            parent_name='Jane Doe',
            parent_email='jane@test.com',
            parent_phone='0987654321',
            parent_relationship='Mother',
            registered_by=self.coordinator_user
        )
        
        # Create another ticket
        ticket2 = Ticket.objects.create(
            full_name='Jane Smith',
            age=14,
            category=Ticket.Category.TEENS,
            gender=Ticket.Gender.FEMALE,
            phone='2345678901',
            email='jane@test.com',
            province='Test Province',
            zone='Zone B',
            area='Area 2',
            parish='Test Parish',
            emergency_contact='John Smith',
            emergency_phone='9876543210',
            emergency_relationship='Father',
            parent_name='John Smith',
            parent_email='john@test.com',
            parent_phone='9876543210',
            parent_relationship='Father',
            registered_by=self.coordinator_user
        )
        
        # Ticket IDs should be sequential
        id1_num = int(ticket1.ticket_id.split('-')[-1])
        id2_num = int(ticket2.ticket_id.split('-')[-1])
        
        self.assertEqual(id2_num, id1_num + 1)
        self.assertNotEqual(ticket1.ticket_id, ticket2.ticket_id)
    
    def test_ticket_age_validation(self):
        """Test that age validation works correctly."""
        # Test valid ages
        valid_ages = [8, 12, 13, 19]
        for age in valid_ages:
            category = Ticket.Category.TEENS if age >= 13 else Ticket.Category.PRE_TEENS
            ticket = Ticket.objects.create(
                full_name=f'Test Person {age}',
                age=age,
                category=category,
                gender=Ticket.Gender.MALE,
                phone='1234567890',
                email=f'test{age}@test.com',
                province='Test Province',
                zone='Zone A',
                area='Area 1',
                parish='Test Parish',
                emergency_contact='Emergency',
                emergency_phone='0987654321',
                emergency_relationship='Parent',
                parent_name='Parent',
                parent_email='parent@test.com',
                parent_phone='0987654321',
                parent_relationship='Parent',
                registered_by=self.coordinator_user
            )
            self.assertEqual(ticket.age, age)
        
        # Test invalid ages (should raise validation error on save)
        invalid_ages = [7, 20]
        for age in invalid_ages:
            try:
                ticket = Ticket(
                    full_name=f'Invalid Person {age}',
                    age=age,
                    category=Ticket.Category.TEENS if age >= 13 else Ticket.Category.PRE_TEENS,
                    gender=Ticket.Gender.MALE,
                    phone='1234567890',
                    email=f'invalid{age}@test.com',
                    province='Test Province',
                    zone='Zone A',
                    area='Area 1',
                    parish='Test Parish',
                    emergency_contact='Emergency',
                    emergency_phone='0987654321',
                    emergency_relationship='Parent',
                    parent_name='Parent',
                    parent_email='parent@test.com',
                    parent_phone='0987654321',
                    parent_relationship='Parent',
                    registered_by=self.coordinator_user
                )
                ticket.full_clean()  # This should raise validation error
                ticket.save()
                self.fail(f"Age {age} should have raised validation error")
            except Exception as e:
                # Expected to fail validation
                pass
    
    def test_ticket_properties(self):
        """Test ticket properties."""
        # Test teen ticket
        teen_ticket = Ticket.objects.create(
            full_name='Teen Person',
            age=15,
            category=Ticket.Category.TEENS,
            gender=Ticket.Gender.MALE,
            phone='1234567890',
            email='teen@test.com',
            province='Test Province',
            zone='Zone A',
            area='Area 1',
            parish='Test Parish',
            emergency_contact='Parent',
            emergency_phone='0987654321',
            emergency_relationship='Parent',
            parent_name='Parent',
            parent_email='parent@test.com',
            parent_phone='0987654321',
            parent_relationship='Parent',
            registered_by=self.coordinator_user
        )
        self.assertTrue(teen_ticket.is_pending)
        self.assertFalse(teen_ticket.is_approved)
        self.assertFalse(teen_ticket.is_rejected)
        self.assertEqual(teen_ticket.get_age_group, 'teens')
        
        # Test pre-teen ticket
        preteen_ticket = Ticket.objects.create(
            full_name='Pre-Teen Person',
            age=10,
            category=Ticket.Category.PRE_TEENS,
            gender=Ticket.Gender.FEMALE,
            phone='2345678901',
            email='preteen@test.com',
            province='Test Province',
            zone='Zone B',
            area='Area 2',
            parish='Test Parish',
            emergency_contact='Parent',
            emergency_phone='9876543210',
            emergency_relationship='Parent',
            parent_name='Parent',
            parent_email='parent@test.com',
            parent_phone='9876543210',
            parent_relationship='Parent',
            registered_by=self.coordinator_user
        )
        self.assertEqual(preteen_ticket.get_age_group, 'pre_teens')
        
        # Test status properties
        teen_ticket.status = Ticket.Status.APPROVED
        teen_ticket.save()
        self.assertFalse(teen_ticket.is_pending)
        self.assertTrue(teen_ticket.is_approved)
        
        teen_ticket.status = Ticket.Status.REJECTED
        teen_ticket.save()
        self.assertTrue(teen_ticket.is_rejected)
    
    def test_ticket_str_representation(self):
        """Test string representation of ticket."""
        ticket = Ticket.objects.create(
            full_name='John Doe',
            age=15,
            category=Ticket.Category.TEENS,
            gender=Ticket.Gender.MALE,
            phone='1234567890',
            email='john@test.com',
            province='Test Province',
            zone='Zone A',
            area='Area 1',
            parish='Test Parish',
            emergency_contact='Jane Doe',
            emergency_phone='0987654321',
            emergency_relationship='Mother',
            parent_name='Jane Doe',
            parent_email='jane@test.com',
            parent_phone='0987654321',
            parent_relationship='Mother',
            registered_by=self.coordinator_user
        )
        
        expected_str = f"{ticket.ticket_id} - {ticket.full_name}"
        self.assertEqual(str(ticket), expected_str)
    
    def test_ticket_save_updates_category(self):
        """Test that ticket save updates category based on age."""
        # Ticket with teen age but pre-teens category
        ticket = Ticket(
            full_name='Teen Person',
            age=15,
            category=Ticket.Category.PRE_TEENS,  # Wrong category
            gender=Ticket.Gender.MALE,
            phone='1234567890',
            email='teen@test.com',
            province='Test Province',
            zone='Zone A',
            area='Area 1',
            parish='Test Parish',
            emergency_contact='Parent',
            emergency_phone='0987654321',
            emergency_relationship='Parent',
            parent_name='Parent',
            parent_email='parent@test.com',
            parent_phone='0987654321',
            parent_relationship='Parent',
            registered_by=self.coordinator_user
        )
        
        # Save should update category based on age
        ticket.save()
        self.assertEqual(ticket.category, Ticket.Category.TEENS)
        
        # Test pre-teen
        ticket2 = Ticket(
            full_name='Pre-Teen Person',
            age=10,
            category=Ticket.Category.TEENS,  # Wrong category
            gender=Ticket.Gender.FEMALE,
            phone='2345678901',
            email='preteen@test.com',
            province='Test Province',
            zone='Zone B',
            area='Area 2',
            parish='Test Parish',
            emergency_contact='Parent',
            emergency_phone='9876543210',
            emergency_relationship='Parent',
            parent_name='Parent',
            parent_email='parent@test.com',
            parent_phone='9876543210',
            parent_relationship='Parent',
            registered_by=self.coordinator_user
        )
        ticket2.save()
        self.assertEqual(ticket2.category, Ticket.Category.PRE_TEENS)

class TicketServiceTest(TestCase):
    """Test cases for TicketService."""
    
    def setUp(self):
        self.coordinator_user = User.objects.create_user(
            username='coordinator',
            password='coordpass123',
            name='Coordinator User',
            email='coordinator@test.com',
            role=User.Role.COORDINATOR,
            province='Test Province'
        )
        
        self.admin_user = User.objects.create_user(
            username='admin',
            password='adminpass123',
            name='Admin User',
            email='admin@test.com',
            role=User.Role.ADMIN
        )
        
        self.ticket_data = {
            'full_name': 'John Doe',
            'age': 15,
            'category': Ticket.Category.TEENS,
            'gender': Ticket.Gender.MALE,
            'phone': '1234567890',
            'email': 'john@test.com',
            'province': 'Test Province',
            'zone': 'Zone A',
            'area': 'Area 1',
            'parish': 'Test Parish',
            'department': 'Music',
            'medical_conditions': 'None',
            'medications': 'None',
            'dietary_restrictions': 'Vegetarian',
            'emergency_contact': 'Jane Doe',
            'emergency_phone': '0987654321',
            'emergency_relationship': 'Mother',
            'parent_name': 'Jane Doe',
            'parent_email': 'jane@test.com',
            'parent_phone': '0987654321',
            'parent_relationship': 'Mother',
        }
    
    def test_create_ticket_success(self):
        """Test successful ticket creation via service."""
        ticket, errors = TicketService.create_ticket(self.ticket_data, self.coordinator_user)
        
        self.assertIsNotNone(ticket)
        self.assertIsNone(errors)
        self.assertEqual(ticket.full_name, 'John Doe')
        self.assertEqual(ticket.registered_by, self.coordinator_user)
        self.assertEqual(ticket.status, Ticket.Status.PENDING)
    
    def test_create_ticket_validation_error(self):
        """Test ticket creation with validation errors."""
        invalid_data = self.ticket_data.copy()
        invalid_data['age'] = 5  # Invalid age
        
        ticket, errors = TicketService.create_ticket(invalid_data, self.coordinator_user)
        
        self.assertIsNone(ticket)
        self.assertIsNotNone(errors)
        self.assertIn('age', errors)
    
    def test_update_ticket_status(self):
        """Test updating ticket status via service."""
        # Create a ticket first
        ticket = Ticket.objects.create(
            **self.ticket_data,
            registered_by=self.coordinator_user
        )
        
        # Test approve
        updated_ticket = TicketService.update_ticket_status(
            ticket, Ticket.Status.APPROVED, self.admin_user
        )
        
        self.assertEqual(updated_ticket.status, Ticket.Status.APPROVED)
        self.assertEqual(updated_ticket.approved_by, self.admin_user)
        self.assertIsNotNone(updated_ticket.approved_at)
        
        # Test reject with reason
        updated_ticket = TicketService.update_ticket_status(
            ticket, Ticket.Status.REJECTED, self.admin_user, "Invalid information"
        )
        
        self.assertEqual(updated_ticket.status, Ticket.Status.REJECTED)
        self.assertEqual(updated_ticket.rejection_reason, "Invalid information")


class BulkUploadServiceTest(TestCase):
    """Test cases for BulkUploadService."""
    
    def setUp(self):
        self.coordinator_user = User.objects.create_user(
            username='coordinator',
            password='coordpass123',
            name='Coordinator User',
            email='coordinator@test.com',
            role=User.Role.COORDINATOR,
            province='Test Province'
        )
        
        # Create sample CSV content
        self.csv_content = """Full Name,Age,Gender,Phone,Email,Province,Zone,Area,Parish,Emergency Contact,Emergency Phone,Emergency Relationship,Parent Name,Parent Email,Parent Phone,Parent Relationship
John Doe,15,Male,1234567890,john@test.com,Test Province,Zone A,Area 1,Parish 1,Jane Doe,0987654321,Mother,Jane Doe,jane@test.com,0987654321,Mother
Jane Smith,12,Female,2345678901,jane@test.com,Test Province,Zone B,Area 2,Parish 2,John Smith,9876543210,Father,John Smith,john.smith@test.com,9876543210,Father
Invalid Person,5,Male,invalid,invalid@test.com,Test Province,Zone C,Area 3,Parish 3,Invalid Parent,invalid,Parent,Invalid Parent,invalid,invalid,Parent"""
    
    def test_process_csv_file(self):
        """Test processing CSV file."""
        # Create a temporary CSV file
        csv_file = SimpleUploadedFile(
            "test.csv",
            self.csv_content.encode('utf-8'),
            content_type="text/csv"
        )
        
        # Process the CSV
        result = BulkUploadService.process_csv_file(csv_file, self.coordinator_user)
        
        # Check results
        self.assertEqual(result['total'], 3)
        self.assertEqual(result['successful'], 2)  # 2 valid rows
        self.assertEqual(result['failed'], 1)  # 1 invalid row (age 5)
        self.assertEqual(len(result['errors']), 1)
        
        # Check that tickets were created
        tickets = Ticket.objects.all()
        self.assertEqual(tickets.count(), 2)
        
        # Check ticket details
        john_ticket = Ticket.objects.get(full_name='John Doe')
        self.assertEqual(john_ticket.age, 15)
        self.assertEqual(john_ticket.gender, Ticket.Gender.MALE)
        self.assertEqual(john_ticket.province, 'Test Province')
        self.assertEqual(john_ticket.registered_by, self.coordinator_user)
    
    def test_clean_row_data(self):
        """Test cleaning row data from CSV."""
        row = {
            'Full Name': 'John Doe',
            'Age': '15',
            'Gender': 'Male',
            'Phone': '1234567890',
            'Email': 'john@test.com',
            'Province': 'Test Province',
            'Zone': 'Zone A',
            'Area': 'Area 1',
            'Parish': 'Parish 1',
            'Emergency Contact': 'Jane Doe',
            'Emergency Phone': '0987654321',
            'Emergency Relationship': 'Mother',
            'Parent Name': 'Jane Doe',
            'Parent Email': 'jane@test.com',
            'Parent Phone': '0987654321',
            'Parent Relationship': 'Mother'
        }
        
        cleaned_data = BulkUploadService._clean_row_data(row)
        
        self.assertEqual(cleaned_data['full_name'], 'John Doe')
        self.assertEqual(cleaned_data['age'], 15)
        self.assertEqual(cleaned_data['gender'], 'Male')
        self.assertEqual(cleaned_data['category'], Ticket.Category.TEENS)
        self.assertEqual(cleaned_data['phone'], '1234567890')
    
    def test_clean_row_data_with_different_headers(self):
        """Test cleaning row data with different header names."""
        row = {
            'full_name': 'John Doe',
            'age': '15',
            'gender': 'Male',
            'phone': '1234567890',
            'email': 'john@test.com'
        }
        
        cleaned_data = BulkUploadService._clean_row_data(row)
        
        self.assertEqual(cleaned_data['full_name'], 'John Doe')
        self.assertEqual(cleaned_data['age'], 15)
        self.assertEqual(cleaned_data['gender'], 'Male')


class DashboardServiceTest(TestCase):
    """Test cases for DashboardService."""
    
    def setUp(self):
        self.admin_user = User.objects.create_user(
            username='admin',
            password='adminpass123',
            name='Admin User',
            email='admin@test.com',
            role=User.Role.ADMIN
        )
        
        self.coordinator_user = User.objects.create_user(
            username='coordinator',
            password='coordpass123',
            name='Coordinator User',
            email='coordinator@test.com',
            role=User.Role.COORDINATOR,
            province='Test Province'
        )
        
        # Create test tickets
        for i in range(5):
            Ticket.objects.create(
                full_name=f'Person {i}',
                age=15,
                category=Ticket.Category.TEENS,
                gender=Ticket.Gender.MALE if i % 2 == 0 else Ticket.Gender.FEMALE,
                phone=f'123456789{i}',
                email=f'person{i}@test.com',
                province='Test Province',
                zone=f'Zone {i % 3}',
                area=f'Area {i}',
                parish=f'Parish {i}',
                emergency_contact=f'Emergency {i}',
                emergency_phone=f'098765432{i}',
                emergency_relationship='Parent',
                parent_name=f'Parent {i}',
                parent_email=f'parent{i}@test.com',
                parent_phone=f'098765432{i}',
                parent_relationship='Parent',
                status=Ticket.Status.APPROVED if i < 3 else Ticket.Status.PENDING,
                registered_by=self.coordinator_user
            )
        
        # Create tickets for another province
        for i in range(3):
            Ticket.objects.create(
                full_name=f'Other Person {i}',
                age=12,
                category=Ticket.Category.PRE_TEENS,
                gender=Ticket.Gender.MALE,
                phone=f'223456789{i}',
                email=f'other{i}@test.com',
                province='Other Province',
                zone=f'Zone {i}',
                area=f'Area {i}',
                parish=f'Parish {i}',
                emergency_contact=f'Emergency {i}',
                emergency_phone=f'198765432{i}',
                emergency_relationship='Parent',
                parent_name=f'Parent {i}',
                parent_email=f'parent.other{i}@test.com',
                parent_phone=f'198765432{i}',
                parent_relationship='Parent',
                status=Ticket.Status.APPROVED,
                registered_by=self.admin_user
            )
    
    def test_get_admin_stats(self):
        """Test admin dashboard statistics."""
        stats = DashboardService.get_admin_stats()
        
        self.assertEqual(stats['global_stats']['total_tickets'], 8)
        self.assertEqual(stats['global_stats']['approved_tickets'], 6)  # 3 from Test + 3 from Other
        self.assertEqual(stats['global_stats']['pending_tickets'], 2)  # Last 2 from Test Province
        self.assertEqual(stats['global_stats']['pre_teens'], 3)  # All from Other Province
        self.assertEqual(stats['global_stats']['teens'], 5)  # All from Test Province
        
        # Check province stats - note: province names are uppercase
        province_stats = stats['province_stats']
        self.assertEqual(len(province_stats), 2)  # Two provinces
        
        # Find Test Province stats (now uppercase)
        test_province_stats = next(
            (p for p in province_stats if p['province'] == 'TEST PROVINCE'), 
            None
        )
        self.assertIsNotNone(test_province_stats)
        self.assertEqual(test_province_stats['total'], 5)
        self.assertEqual(test_province_stats['approved'], 3)
        self.assertEqual(test_province_stats['pending'], 2)
    
    def test_get_coordinator_stats(self):
        """Test coordinator dashboard statistics."""
        stats = DashboardService.get_coordinator_stats(self.coordinator_user)
        
        self.assertEqual(stats['stats']['total_tickets'], 5)
        self.assertEqual(stats['stats']['approved_tickets'], 3)
        self.assertEqual(stats['stats']['pending_tickets'], 2)
        self.assertEqual(stats['stats']['teens'], 5)  # All are teens
        self.assertEqual(stats['stats']['pre_teens'], 0)


class TicketAPITest(APITestCase):
    """Test cases for Ticket API endpoints."""
    
    def setUp(self):
        self.admin_user = User.objects.create_user(
            username='admin',
            password='adminpass123',
            name='Admin User',
            email='admin@test.com',
            role=User.Role.ADMIN
        )
        
        self.coordinator_user = User.objects.create_user(
            username='coordinator',
            password='coordpass123',
            name='Coordinator User',
            email='coordinator@test.com',
            role=User.Role.COORDINATOR,
            province='Test Province'
        )
        
        self.other_coordinator_user = User.objects.create_user(
            username='other_coordinator',
            password='coordpass123',
            name='Other Coordinator',
            email='other@test.com',
            role=User.Role.COORDINATOR,
            province='Other Province'
        )
        
        self.client = APIClient()
        
        # Create test tickets
        self.ticket = Ticket.objects.create(
            full_name='John Doe',
            age=15,
            category=Ticket.Category.TEENS,
            gender=Ticket.Gender.MALE,
            phone='1234567890',
            email='john@test.com',
            province='Test Province',
            zone='Zone A',
            area='Area 1',
            parish='Test Parish',
            emergency_contact='Jane Doe',
            emergency_phone='0987654321',
            emergency_relationship='Mother',
            parent_name='Jane Doe',
            parent_email='jane@test.com',
            parent_phone='0987654321',
            parent_relationship='Mother',
            registered_by=self.coordinator_user
        )
        
        # Create ticket for other province
        self.other_ticket = Ticket.objects.create(
            full_name='Other Person',
            age=12,
            category=Ticket.Category.PRE_TEENS,
            gender=Ticket.Gender.FEMALE,
            phone='2234567890',
            email='other@test.com',
            province='Other Province',
            zone='Zone B',
            area='Area 2',
            parish='Other Parish',
            emergency_contact='Other Parent',
            emergency_phone='1987654321',
            emergency_relationship='Parent',
            parent_name='Other Parent',
            parent_email='parent@test.com',
            parent_phone='1987654321',
            parent_relationship='Parent',
            registered_by=self.other_coordinator_user
        )
        
        self.ticket_data = {
            'full_name': 'New Person',
            'age': 16,
            'category': Ticket.Category.TEENS,
            'gender': Ticket.Gender.MALE,
            'phone': '3334567890',
            'email': 'new@test.com',
            'province': 'Test Province',
            'zone': 'Zone C',
            'area': 'Area 3',
            'parish': 'New Parish',
            'department': 'Music',
            'medical_conditions': 'None',
            'medications': 'None',
            'dietary_restrictions': 'None',
            'emergency_contact': 'New Parent',
            'emergency_phone': '2987654321',
            'emergency_relationship': 'Father',
            'parent_name': 'New Parent',
            'parent_email': 'new.parent@test.com',
            'parent_phone': '2987654321',
            'parent_relationship': 'Father',
        }
    
    def test_list_tickets_as_admin(self):
        """Test admin can list all tickets."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(reverse('ticket-list'))
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)  # Both tickets
        self.assertContains(response, 'John Doe')
        self.assertContains(response, 'Other Person')
    
    def test_list_tickets_as_coordinator(self):
        """Test coordinator can only see their province's tickets."""
        self.client.force_authenticate(user=self.coordinator_user)
        response = self.client.get(reverse('ticket-list'))
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)  # Only Test Province ticket
        self.assertContains(response, 'John Doe')
        self.assertNotContains(response, 'Other Person')
    
    def test_create_ticket_as_coordinator(self):
        """Test coordinator can create ticket."""
        self.client.force_authenticate(user=self.coordinator_user)
        response = self.client.post(reverse('ticket-list'), self.ticket_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['full_name'], 'New Person')
        self.assertEqual(response.data['registered_by_name'], 'Coordinator User')
        self.assertEqual(response.data['status'], 'pending')
        
        # Verify ticket was created
        ticket = Ticket.objects.get(full_name='New Person')
        self.assertEqual(ticket.registered_by, self.coordinator_user)
        self.assertEqual(ticket.province, 'Test Province')
    
    def test_create_ticket_validation_error(self):
        """Test ticket creation with invalid data."""
        self.client.force_authenticate(user=self.coordinator_user)
        invalid_data = self.ticket_data.copy()
        invalid_data['age'] = 5  # Invalid age
        
        response = self.client.post(reverse('ticket-list'), invalid_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('age', response.data)
    
    def test_retrieve_ticket_as_admin(self):
        """Test admin can retrieve any ticket."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(reverse('ticket-detail', args=[self.ticket.id]))
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['full_name'], 'John Doe')
    
    def test_retrieve_ticket_as_coordinator(self):
        """Test coordinator can retrieve their province's ticket."""
        self.client.force_authenticate(user=self.coordinator_user)
        response = self.client.get(reverse('ticket-detail', args=[self.ticket.id]))
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['full_name'], 'John Doe')
    
    def test_retrieve_other_province_ticket_as_coordinator(self):
        """Test coordinator cannot retrieve other province's ticket."""
        self.client.force_authenticate(user=self.coordinator_user)
        response = self.client.get(reverse('ticket-detail', args=[self.other_ticket.id]))
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_update_ticket_status_as_admin(self):
        """Test admin can update any ticket status."""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse('ticket-update-status', args=[self.ticket.id])
        data = {'status': 'approved'}
        
        response = self.client.patch(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'approved')
        
        # Refresh from db
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, Ticket.Status.APPROVED)
        self.assertEqual(self.ticket.approved_by, self.admin_user)
    
    def test_update_ticket_status_as_coordinator(self):
        """Test coordinator can update their province's ticket status."""
        self.client.force_authenticate(user=self.coordinator_user)
        url = reverse('ticket-update-status', args=[self.ticket.id])
        data = {'status': 'approved'}
        
        response = self.client.patch(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'approved')
    
    def test_update_other_province_ticket_status_as_coordinator(self):
        """Test coordinator cannot update other province's ticket status."""
        self.client.force_authenticate(user=self.coordinator_user)
        url = reverse('ticket-update-status', args=[self.other_ticket.id])
        data = {'status': 'approved'}
        
        response = self.client.patch(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_filter_tickets_by_status(self):
        """Test filtering tickets by status."""
        self.client.force_authenticate(user=self.admin_user)
        
        # Approve one ticket
        self.ticket.status = Ticket.Status.APPROVED
        self.ticket.save()
        
        # Filter by approved status
        response = self.client.get(f"{reverse('ticket-list')}?status=approved")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['full_name'], 'John Doe')
        
        # Filter by pending status
        response = self.client.get(f"{reverse('ticket-list')}?status=pending")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['full_name'], 'Other Person')
    
    def test_search_tickets(self):
        """Test searching tickets."""
        self.client.force_authenticate(user=self.admin_user)
        
        # Search by name
        response = self.client.get(f"{reverse('ticket-list')}?search=John")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['full_name'], 'John Doe')
        
        # Search by email
        response = self.client.get(f"{reverse('ticket-list')}?search=other@test.com")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['full_name'], 'Other Person')


class BulkUploadAPITest(APITestCase):
    """Test cases for Bulk Upload API endpoints."""
    
    def setUp(self):
        self.coordinator_user = User.objects.create_user(
            username='coordinator',
            password='coordpass123',
            name='Coordinator User',
            email='coordinator@test.com',
            role=User.Role.COORDINATOR,
            province='Test Province'
        )
        
        self.admin_user = User.objects.create_user(
            username='admin',
            password='adminpass123',
            name='Admin User',
            email='admin@test.com',
            role=User.Role.ADMIN
        )
        
        self.client = APIClient()
        
        # Create CSV content
        self.csv_content = """Full Name,Age,Gender,Phone,Email,Province,Zone,Area,Parish,Emergency Contact,Emergency Phone,Emergency Relationship,Parent Name,Parent Email,Parent Phone,Parent Relationship
John Doe,15,Male,1234567890,john@test.com,Test Province,Zone A,Area 1,Parish 1,Jane Doe,0987654321,Mother,Jane Doe,jane@test.com,0987654321,Mother
Jane Smith,12,Female,2345678901,jane@test.com,Test Province,Zone B,Area 2,Parish 2,John Smith,9876543210,Father,John Smith,john.smith@test.com,9876543210,Father"""
    
    def test_bulk_upload_as_coordinator(self):
        """Test coordinator can upload CSV."""
        self.client.force_authenticate(user=self.coordinator_user)
        
        csv_file = SimpleUploadedFile(
            "test.csv",
            self.csv_content.encode('utf-8'),
            content_type="text/csv"
        )
        
        url = reverse('ticket-bulk-create')
        response = self.client.post(url, {'file': csv_file}, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['stats']['total'], 2)
        self.assertEqual(response.data['stats']['successful'], 2)
        self.assertEqual(response.data['stats']['failed'], 0)
        
        # Check that tickets were created
        tickets = Ticket.objects.filter(province='Test Province')
        self.assertEqual(tickets.count(), 2)
        
        # Check that bulk upload record was created
        bulk_uploads = BulkUpload.objects.filter(uploaded_by=self.coordinator_user)
        self.assertEqual(bulk_uploads.count(), 1)
        self.assertEqual(bulk_uploads.first().status, 'completed')
    
    def test_bulk_upload_as_admin_not_allowed(self):
        """Test admin cannot upload CSV (only coordinators)."""
        self.client.force_authenticate(user=self.admin_user)
        
        csv_file = SimpleUploadedFile(
            "test.csv",
            self.csv_content.encode('utf-8'),
            content_type="text/csv"
        )
        
        url = reverse('ticket-bulk-create')
        response = self.client.post(url, {'file': csv_file}, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_bulk_upload_invalid_file_format(self):
        """Test uploading non-CSV file."""
        self.client.force_authenticate(user=self.coordinator_user)
        
        invalid_file = SimpleUploadedFile(
            "test.txt",
            b"Not a CSV file",
            content_type="text/plain"
        )
        
        url = reverse('ticket-bulk-create')
        response = self.client.post(url, {'file': invalid_file}, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('file', response.data)
    
    def test_list_bulk_uploads(self):
        """Test listing bulk uploads."""
        # Create a bulk upload
        bulk_upload = BulkUpload.objects.create(
            file=SimpleUploadedFile("test.csv", b"content"),
            uploaded_by=self.coordinator_user,
            status='completed',
            total_records=10,
            successful_records=8,
            failed_records=2
        )
        
        self.client.force_authenticate(user=self.coordinator_user)
        response = self.client.get(reverse('bulk-upload-list'))
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['upload_id'], str(bulk_upload.upload_id))


class DashboardAPITest(APITestCase):
    """Test cases for Dashboard API endpoints."""
    
    def setUp(self):
        self.admin_user = User.objects.create_user(
            username='admin',
            password='adminpass123',
            name='Admin User',
            email='admin@test.com',
            role=User.Role.ADMIN
        )
        
        self.coordinator_user = User.objects.create_user(
            username='coordinator',
            password='coordpass123',
            name='Coordinator User',
            email='coordinator@test.com',
            role=User.Role.COORDINATOR,
            province='Test Province'
        )
        
        self.client = APIClient()
        
        # Create test tickets
        for i in range(3):
            Ticket.objects.create(
                full_name=f'Person {i}',
                age=15,
                category=Ticket.Category.TEENS,
                gender=Ticket.Gender.MALE,
                phone=f'123456789{i}',
                email=f'person{i}@test.com',
                province='Test Province',
                zone=f'Zone {i}',
                area=f'Area {i}',
                parish=f'Parish {i}',
                emergency_contact=f'Emergency {i}',
                emergency_phone=f'098765432{i}',
                emergency_relationship='Parent',
                parent_name=f'Parent {i}',
                parent_email=f'parent{i}@test.com',
                parent_phone=f'098765432{i}',
                parent_relationship='Parent',
                status=Ticket.Status.APPROVED if i < 2 else Ticket.Status.PENDING,
                registered_by=self.coordinator_user
            )
        
        # Create tickets for another province
        Ticket.objects.create(
            full_name='Other Person',
            age=12,
            category=Ticket.Category.PRE_TEENS,
            gender=Ticket.Gender.FEMALE,
            phone='2234567890',
            email='other@test.com',
            province='Other Province',
            zone='Zone X',
            area='Area X',
            parish='Parish X',
            emergency_contact='Other Parent',
            emergency_phone='1987654321',
            emergency_relationship='Parent',
            parent_name='Other Parent',
            parent_email='parent@test.com',
            parent_phone='1987654321',
            parent_relationship='Parent',
            status=Ticket.Status.APPROVED,
            registered_by=self.admin_user
        )
    
    def test_admin_dashboard(self):
        """Test admin dashboard."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(reverse('dashboard'))
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check global stats
        self.assertEqual(response.data['global_stats']['total_tickets'], 4)
        self.assertEqual(response.data['global_stats']['approved_tickets'], 3)  # 2 from Test + 1 from Other
        self.assertEqual(response.data['global_stats']['pending_tickets'], 1)
        self.assertEqual(response.data['global_stats']['pre_teens'], 1)
        self.assertEqual(response.data['global_stats']['teens'], 3)
        
        # Check province stats
        self.assertEqual(len(response.data['province_stats']), 2)
        
        # Check recent tickets
        self.assertEqual(len(response.data['recent_tickets']), 4)
    
    def test_coordinator_dashboard(self):
        """Test coordinator dashboard."""
        self.client.force_authenticate(user=self.coordinator_user)
        response = self.client.get(reverse('dashboard'))
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check stats
        self.assertEqual(response.data['stats']['total_tickets'], 3)
        self.assertEqual(response.data['stats']['approved_tickets'], 2)
        self.assertEqual(response.data['stats']['pending_tickets'], 1)
        self.assertEqual(response.data['stats']['teens'], 3)
        
        # Check recent tickets
        self.assertEqual(len(response.data['recent_tickets']), 3)
        # All tickets should be from Test Province
        for ticket in response.data['recent_tickets']:
            self.assertEqual(ticket['province'], 'Test Province')
    
    def test_dashboard_unauthenticated(self):
        """Test dashboard access without authentication."""
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class EdgeCaseTests(TestCase):
    """Test edge cases and error conditions."""
    
    def setUp(self):
        self.coordinator_user = User.objects.create_user(
            username='coordinator',
            password='coordpass123',
            name='Coordinator User',
            email='coordinator@test.com',
            role=User.Role.COORDINATOR,
            province='Test Province'
        )
    
    def test_ticket_with_special_characters(self):
        """Test ticket creation with special characters in names."""
        ticket_data = {
            'full_name': 'Jöhn Döé',
            'age': 15,
            'category': Ticket.Category.TEENS,
            'gender': Ticket.Gender.MALE,
            'phone': '1234567890',
            'email': 'john@test.com',
            'province': 'Test Province',
            'zone': 'Zone A',
            'area': 'Area 1',
            'parish': 'Parish 1',
            'emergency_contact': 'Jäne Döé',
            'emergency_phone': '0987654321',
            'emergency_relationship': 'Möther',
            'parent_name': 'Jäne Döé',
            'parent_email': 'jane@test.com',
            'parent_phone': '0987654321',
            'parent_relationship': 'Möther',
        }
        
        ticket = Ticket.objects.create(
            **ticket_data,
            registered_by=self.coordinator_user
        )
        
        self.assertEqual(ticket.full_name, 'Jöhn Döé')
        self.assertEqual(ticket.emergency_contact, 'Jäne Döé')
    
    def test_ticket_with_very_long_fields(self):
        """Test ticket creation with maximum length fields."""
        long_string = 'A' * 255
        
        ticket_data = {
            'full_name': long_string,
            'age': 15,
            'category': Ticket.Category.TEENS,
            'gender': Ticket.Gender.MALE,
            'phone': '1234567890',
            'email': 'test@test.com',
            'province': long_string,
            'zone': long_string,
            'area': long_string,
            'parish': long_string,
            'emergency_contact': long_string,
            'emergency_phone': '0987654321',
            'emergency_relationship': 'Parent',
            'parent_name': long_string,
            'parent_email': 'parent@test.com',
            'parent_phone': '0987654321',
            'parent_relationship': 'Parent',
        }
        
        ticket = Ticket.objects.create(
            **ticket_data,
            registered_by=self.coordinator_user
        )
        
        self.assertEqual(len(ticket.full_name), 255)
        self.assertEqual(len(ticket.province), 255)
    
    def test_duplicate_ticket_id_regeneration(self):
        """Test that ticket IDs don't duplicate."""
        # Create first ticket
        ticket1 = Ticket.objects.create(
            full_name='Person 1',
            age=15,
            category=Ticket.Category.TEENS,
            gender=Ticket.Gender.MALE,
            phone='1111111111',
            email='person1@test.com',
            province='Test Province',
            zone='Zone A',
            area='Area 1',
            parish='Parish 1',
            emergency_contact='Emergency 1',
            emergency_phone='0999999999',
            emergency_relationship='Parent',
            parent_name='Parent 1',
            parent_email='parent1@test.com',
            parent_phone='0999999999',
            parent_relationship='Parent',
            registered_by=self.coordinator_user
        )
        
        # Get the current date format from the generated ticket ID
        # Extract the date part (e.g., "202512" from "R63-202512-0001")
        date_part = ticket1.ticket_id.split('-')[1]
        first_num = int(ticket1.ticket_id.split('-')[-1])
        
        # Create second ticket
        ticket2 = Ticket.objects.create(
            full_name='Person 2',
            age=16,
            category=Ticket.Category.TEENS,
            gender=Ticket.Gender.FEMALE,
            phone='2222222222',
            email='person2@test.com',
            province='Test Province',
            zone='Zone B',
            area='Area 2',
            parish='Parish 2',
            emergency_contact='Emergency 2',
            emergency_phone='0888888888',
            emergency_relationship='Parent',
            parent_name='Parent 2',
            parent_email='parent2@test.com',
            parent_phone='0888888888',
            parent_relationship='Parent',
            registered_by=self.coordinator_user
        )
        
        # Ticket ID should be sequential and have same date part
        self.assertTrue(ticket2.ticket_id.startswith(f'R63-{date_part}-'))
        second_num = int(ticket2.ticket_id.split('-')[-1])
        self.assertEqual(second_num, first_num + 1)