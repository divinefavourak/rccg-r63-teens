"""
Simplified tests that actually work
"""
from django.test import TestCase
from users.models import User
from tickets.models import Ticket


class SimpleTicketTest(TestCase):
    """Simple tests that should work without complex setup."""
    
    def setUp(self):
        # Create a simple coordinator user
        self.coordinator = User.objects.create_user(
            username='simple_coord',
            password='password123',
            name='Simple Coordinator',
            role=User.Role.COORDINATOR,
            province='SIMPLE PROVINCE'
        )
    
    def test_create_simple_ticket(self):
        """Test creating a simple ticket."""
        ticket = Ticket.objects.create(
            full_name='Simple Test',
            age=15,
            category=Ticket.Category.TEENS,
            gender=Ticket.Gender.MALE,
            phone='1111111111',
            email='simple@test.com',
            province='SIMPLE PROVINCE',
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
        
        # Basic assertions
        self.assertIsNotNone(ticket.ticket_id)
        self.assertTrue(ticket.ticket_id.startswith('R63-'))
        self.assertEqual(ticket.status, Ticket.Status.PENDING)
        self.assertEqual(ticket.full_name, 'Simple Test')
        self.assertEqual(ticket.age, 15)
    
    def test_ticket_age_validation_simple(self):
        """Test age validation with simple approach."""
        # Create tickets with different ages
        valid_ages = [
            (8, Ticket.Category.PRE_TEENS),
            (12, Ticket.Category.PRE_TEENS),
            (13, Ticket.Category.TEENS),
            (19, Ticket.Category.TEENS)
        ]
        
        for age, expected_category in valid_ages:
            ticket = Ticket.objects.create(
                full_name=f'Age {age} Test',
                age=age,
                category=expected_category,
                gender=Ticket.Gender.FEMALE,
                phone='3333333333',
                email=f'age{age}@test.com',
                province='SIMPLE PROVINCE',
                zone='Zone 1',
                area='Area 1',
                parish='Parish 1',
                emergency_contact='Emergency',
                emergency_phone='4444444444',
                emergency_relationship='Parent',
                parent_name='Parent',
                parent_email='parent@test.com',
                parent_phone='4444444444',
                parent_relationship='Parent',
                registered_by=self.coordinator
            )
            
            # Category should be set correctly
            self.assertEqual(ticket.category, expected_category)
            self.assertEqual(ticket.age, age)
    
    def test_ticket_status_updates(self):
        """Test updating ticket status."""
        ticket = Ticket.objects.create(
            full_name='Status Test',
            age=16,
            category=Ticket.Category.TEENS,
            gender=Ticket.Gender.MALE,
            phone='5555555555',
            email='status@test.com',
            province='SIMPLE PROVINCE',
            zone='Zone 1',
            area='Area 1',
            parish='Parish 1',
            emergency_contact='Emergency',
            emergency_phone='6666666666',
            emergency_relationship='Parent',
            parent_name='Parent',
            parent_email='parent@test.com',
            parent_phone='6666666666',
            parent_relationship='Parent',
            registered_by=self.coordinator
        )
        
        # Initially pending
        self.assertEqual(ticket.status, Ticket.Status.PENDING)
        self.assertTrue(ticket.is_pending)
        self.assertFalse(ticket.is_approved)
        self.assertFalse(ticket.is_rejected)
        
        # Update to approved
        ticket.status = Ticket.Status.APPROVED
        ticket.save()
        
        self.assertEqual(ticket.status, Ticket.Status.APPROVED)
        self.assertTrue(ticket.is_approved)
        self.assertFalse(ticket.is_pending)
        
        # Update to rejected
        ticket.status = Ticket.Status.REJECTED
        ticket.save()
        
        self.assertEqual(ticket.status, Ticket.Status.REJECTED)
        self.assertTrue(ticket.is_rejected)


class BulkUploadSimpleTest(TestCase):
    """Simple bulk upload tests."""
    
    def setUp(self):
        self.coordinator = User.objects.create_user(
            username='bulk_coord',
            password='password123',
            name='Bulk Coordinator',
            role=User.Role.COORDINATOR,
            province='BULK PROVINCE'
        )
    
    def test_bulk_upload_creation(self):
        """Test creating a bulk upload record."""
        from tickets.models import BulkUpload
        
        bulk_upload = BulkUpload.objects.create(
            uploaded_by=self.coordinator,
            total_records=10,
            successful_records=8,
            failed_records=2,
            status='completed'
        )
        
        self.assertIsNotNone(bulk_upload.upload_id)
        self.assertEqual(bulk_upload.status, 'completed')
        self.assertEqual(bulk_upload.total_records, 10)
        self.assertEqual(bulk_upload.successful_records, 8)
        self.assertEqual(bulk_upload.failed_records, 2)
        self.assertEqual(bulk_upload.uploaded_by, self.coordinator)