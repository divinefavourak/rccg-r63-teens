from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone
from unittest.mock import patch, Mock, MagicMock
from decimal import Decimal
import json

# Import your actual models and services
from .models import Payment, PaymentPlan, TransactionLog
from users.models import User
from tickets.models import Ticket
from .services import SquadError, SquadService, PaymentService, _charge
from .serializers import PaymentSerializer, PaymentPlanSerializer


def result_list(response):
    """Items from a DRF list response, whether or not pagination is enabled."""
    data = response.data
    if isinstance(data, dict) and 'results' in data:
        return data['results']
    return data

# SquadService.__init__ refuses to construct without a key. The tests below
# mock every outbound Squad call, so this dummy value only needs to be
# non-empty — no request ever reaches Squad.
squad_test_keys = override_settings(SQUAD_SECRET_KEY='sandbox_sk_dummy')


def squad_charge(reference, amount=300000, status='Success'):
    """What `SquadService.verify_payment` returns for a transaction."""
    return _charge({
        'transaction_ref': reference,
        'transaction_status': status,
        'transaction_amount': amount,  # in kobo
        'transaction_type': 'Card',
        'gateway_transaction_ref': f'{reference}_1_1',
    })


def squad_webhook(reference, amount=300000, event='charge_successful'):
    """The body of the webhook Squad sends for a charge, as bytes."""
    return json.dumps({
        'Event': event,
        'TransactionRef': reference,
        'Body': {
            'amount': amount,  # in kobo
            'transaction_ref': reference,
            'gateway_ref': f'{reference}_1_1',
            'transaction_status': 'Success',
            'currency': 'NGN',
            'transaction_type': 'Card',
            'merchant_amount': amount,
            'meta': {},
            'is_recurring': False,
        },
    }).encode('utf-8')


class PaymentModelTests(TestCase):
    """Tests for Payment model using actual implementation"""
    
    def setUp(self):
        # Create a user using your actual User model
        self.user = User.objects.create_user(
            username='testcoordinator',
            email='coordinator@rccg.com',
            password='testpass123',
            first_name='Test',
            last_name='Coordinator',
            phone='+2348012345678',
            role=User.Role.COORDINATOR,
            province=User.Province.LAGOS_PROVINCE_9,
            zone='Test Zone',
            area='Test Area',
            parish='Test Parish'
        )
        
        # Create a ticket using your actual Ticket model
        self.ticket = Ticket.objects.create(
            full_name='John Doe Teen',
            age=15,
            category=Ticket.Category.TEENS,
            gender=Ticket.Gender.MALE,
            phone='+2348012345679',
            email='teen@example.com',
            province='lagos_province_9',
            zone='Zone A',
            area='Area 1',
            parish='Parish XYZ',
            emergency_contact='Jane Doe',
            emergency_phone='+2348023456789',
            emergency_relationship='Mother',
            parent_name='Jane Doe',
            parent_email='parent@example.com',
            parent_phone='+2348023456789',
            parent_relationship='Mother',
            registered_by=self.user
        )
    
    def test_create_payment_with_actual_model(self):
        """Test creating a payment using your actual Payment model"""
        
        # Create payment using your model
        payment = Payment.objects.create(
            reference='TEST_PAY_001',
            amount=Decimal('5000.00'),
            currency='NGN',
            ticket=self.ticket,
            description='Registration fee for teen event',
            payer_email=self.user.email,
            payer_name=self.user.full_name,
            payer_phone=self.user.phone,
            status=Payment.Status.PENDING,
            metadata={
                'ticket_id': str(self.ticket.id),
                'ticket_reference': self.ticket.ticket_id,
                'user_id': str(self.user.id)
            }
        )
        
        
        # Verify the payment was created correctly
        self.assertEqual(payment.reference, 'TEST_PAY_001')
        self.assertEqual(payment.amount, Decimal('5000.00'))
        self.assertEqual(payment.currency, 'NGN')
        self.assertEqual(payment.status, Payment.Status.PENDING)
        self.assertEqual(payment.ticket, self.ticket)
        self.assertEqual(payment.payer_email, self.user.email)
        self.assertEqual(payment.payer_name, self.user.full_name)
        
        # Test properties
        self.assertTrue(payment.is_pending)
        self.assertFalse(payment.is_successful)
        self.assertEqual(payment.formatted_amount, '₦5,000.00')
        
    
    def test_payment_status_transitions(self):
        """Test payment status transitions using your actual model"""
        
        # Create a payment
        payment = Payment.objects.create(
            reference='TEST_STATUS_001',
            amount=Decimal('3000.00'),
            currency='NGN',
            ticket=self.ticket,
            description='Test status transitions',
            payer_email=self.user.email,
            status=Payment.Status.PENDING
        )
        
        self.assertEqual(payment.status, Payment.Status.PENDING)
        self.assertTrue(payment.is_pending)
        
        # Test marking as successful (using your actual method)
        payment.mark_as_successful(squad_charge('TEST_STATUS_001'))
        
        self.assertEqual(payment.status, Payment.Status.SUCCESS)
        self.assertTrue(payment.is_successful)
        self.assertFalse(payment.is_pending)
        self.assertIsNotNone(payment.completed_at)
        self.assertEqual(payment.gateway_reference, 'TEST_STATUS_001_1_1')
        self.assertEqual(payment.channel, 'card')
        self.assertEqual(payment.payment_method, Payment.PaymentMethod.CARD)
        
    
    def test_payment_serializer(self):
        """Test your actual PaymentSerializer"""
        
        # Create a payment
        payment = Payment.objects.create(
            reference='TEST_SERIALIZER_001',
            amount=Decimal('4000.00'),
            currency='NGN',
            ticket=self.ticket,
            description='Test serializer',
            payer_email=self.user.email,
            payer_name=self.user.full_name,
            status=Payment.Status.SUCCESS,
            completed_at=timezone.now()
        )
        
        # Use your actual serializer
        serializer = PaymentSerializer(payment)
        
        
        # Verify serializer fields
        self.assertEqual(serializer.data['reference'], 'TEST_SERIALIZER_001')
        self.assertEqual(serializer.data['amount'], '4000.00')
        self.assertEqual(serializer.data['status'], 'success')
        self.assertEqual(serializer.data['payer_email'], self.user.email)
        self.assertEqual(serializer.data['formatted_amount'], '₦4,000.00')
        self.assertTrue(serializer.data['is_successful'])
        self.assertFalse(serializer.data['is_pending'])
        


class PaymentPlanTests(TestCase):
    """Tests for PaymentPlan model using actual implementation"""
    
    def test_create_payment_plan(self):
        """Test creating a payment plan using your actual model"""
        
        valid_from = timezone.now()
        valid_to = valid_from + timezone.timedelta(days=30)
        
        # Create payment plan using your model
        plan = PaymentPlan.objects.create(
            name='Early Bird Discount',
            plan_type=PaymentPlan.PlanType.EARLY_BIRD,
            description='Special discount for early registration',
            amount=Decimal('4000.00'),
            currency='NGN',
            valid_from=valid_from,
            valid_to=valid_to,
            ticket_category=Ticket.Category.TEENS,
            max_usage=100,
            is_active=True
        )
        
        
        # Verify the plan
        self.assertEqual(plan.name, 'Early Bird Discount')
        self.assertEqual(plan.plan_type, PaymentPlan.PlanType.EARLY_BIRD)
        self.assertEqual(plan.amount, Decimal('4000.00'))
        self.assertEqual(plan.currency, 'NGN')
        self.assertEqual(plan.formatted_amount, '₦4,000.00')
        self.assertTrue(plan.is_active)
        self.assertEqual(plan.ticket_category, Ticket.Category.TEENS)
        self.assertEqual(plan.max_usage, 100)
        self.assertEqual(plan.usage_count, 0)
        
        # Test is_valid property
        self.assertTrue(plan.is_valid)
        
        # Test increment_usage
        self.assertTrue(plan.increment_usage())
        self.assertEqual(plan.usage_count, 1)
        
        # Test serializer
        serializer = PaymentPlanSerializer(plan)
        self.assertEqual(serializer.data['name'], 'Early Bird Discount')
        self.assertEqual(serializer.data['amount'], '4000.00')
        self.assertTrue(serializer.data['is_valid'])
        


@squad_test_keys
class PaymentServiceTests(TestCase):
    """Tests for your actual PaymentService"""
    
    def setUp(self):
        # Create test data
        self.user = User.objects.create_user(
            username='testuser',
            email='user@rccg.com',
            password='testpass123',
            first_name='Test',
            last_name='User',
            phone='+2348012345678',
            role=User.Role.COORDINATOR,
            province=User.Province.LAGOS_PROVINCE_9
        )
        
        self.ticket = Ticket.objects.create(
            full_name='Test Teen',
            age=14,
            category=Ticket.Category.TEENS,
            gender=Ticket.Gender.MALE,
            phone='+2348012345679',
            email='teen@example.com',
            province='lagos_province_9',
            zone='Zone A',
            area='Area 1',
            parish='Parish XYZ',
            emergency_contact='Parent',
            emergency_phone='+2348023456789',
            emergency_relationship='Father',
            parent_name='Parent Name',
            parent_email='parent@example.com',
            parent_phone='+2348023456789',
            parent_relationship='Father',
            registered_by=self.user
        )
        
        # Create PaymentService instance
        self.payment_service = PaymentService()
    
    @patch.object(SquadService, 'open_checkout')
    @patch.object(SquadService, 'generate_reference')
    def test_create_payment_integration(self, mock_generate_ref, mock_initialize):
        """Test payment creation with actual service"""
        
        # Mock the dependencies
        mock_generate_ref.return_value = 'RCCG20250101123456'
        mock_initialize.return_value = 'https://sandbox-pay.squadco.com/RCCG20250101123456'
        
        # Create mock request
        mock_request = Mock()
        mock_request.META = {
            'REMOTE_ADDR': '127.0.0.1',
            'HTTP_USER_AGENT': 'TestClient/1.0'
        }
        
        # Call your actual service method
        payment, checkout_url = self.payment_service.create_payment(
            ticket=self.ticket,
            user=self.user,
            request=mock_request
        )
        
        
        # Verify results
        self.assertEqual(payment.reference, 'RCCG20250101123456')
        self.assertEqual(payment.amount, Decimal('3000.00'))  # Default fee in PaymentService.create_payment
        self.assertEqual(payment.ticket, self.ticket)
        self.assertEqual(payment.payer_email, self.user.email)
        self.assertEqual(payment.status, Payment.Status.PENDING)
        
        # Verify Squad service was called, for the ticket's price
        mock_generate_ref.assert_called_once()
        mock_initialize.assert_called_once()
        self.assertEqual(mock_initialize.call_args.kwargs['amount'], Decimal('3000.00'))

        # Verify the response
        self.assertEqual(checkout_url, 'https://sandbox-pay.squadco.com/RCCG20250101123456')
        self.assertEqual(payment.authorization_url, checkout_url)
        
    
    @patch.object(SquadService, 'verify_payment')
    def test_verify_payment_integration(self, mock_verify):
        """Test payment verification with actual service"""
        
        # Create a pending payment
        payment = Payment.objects.create(
            reference='VERIFY_TEST_001',
            amount=Decimal('5000.00'),
            currency='NGN',
            ticket=self.ticket,
            description='Test verification',
            payer_email=self.user.email,
            status=Payment.Status.PENDING
        )
        
        # Mock Squad verification
        mock_verify.return_value = squad_charge('VERIFY_TEST_001', amount=500000)
        
        # Call your actual service method
        result = self.payment_service.verify_and_complete_payment(
            reference=payment.reference,
            request=None
        )
        
        
        # Verify result
        self.assertEqual(result, payment)
        self.assertEqual(result.status, Payment.Status.SUCCESS)
        self.assertEqual(result.gateway_reference, 'VERIFY_TEST_001_1_1')
        


@squad_test_keys
class PaymentAPITests(APITestCase):
    """API tests using your actual views and serializers"""
    
    def setUp(self):
        # Create test users
        self.admin = User.objects.create_superuser(
            username='admin',
            email='admin@rccg.com',
            password='adminpass',
            first_name='Admin',
            last_name='User'
        )
        
        self.coordinator = User.objects.create_user(
            username='coordinator',
            email='coordinator@rccg.com',
            password='coordpass',
            first_name='Coord',
            last_name='Inator',
            role=User.Role.COORDINATOR,
            province=User.Province.LAGOS_PROVINCE_9,
            zone='Test Zone',
            area='Test Area',
            parish='Test Parish'
        )
        
        self.regular_user = User.objects.create_user(
            username='regular',
            email='regular@rccg.com',
            password='userpass',
            first_name='Regular',
            last_name='User',
            role=User.Role.COORDINATOR,
            province=User.Province.LAGOS_PROVINCE_28
        )
        
        # Create a ticket
        self.ticket = Ticket.objects.create(
            full_name='API Test Teen',
            age=15,
            category=Ticket.Category.TEENS,
            gender=Ticket.Gender.FEMALE,
            phone='+2348012345670',
            email='api_test@example.com',
            province='lagos_province_9',
            zone='Zone B',
            area='Area 2',
            parish='Parish ABC',
            emergency_contact='Emergency',
            emergency_phone='+2348023456700',
            emergency_relationship='Sister',
            parent_name='Parent',
            parent_email='parent_api@example.com',
            parent_phone='+2348023456700',
            parent_relationship='Parent',
            registered_by=self.coordinator
        )
        
        # Create payment plan
        self.payment_plan = PaymentPlan.objects.create(
            name='Regular Registration',
            plan_type=PaymentPlan.PlanType.REGULAR,
            amount=Decimal('5000.00'),
            valid_from=timezone.now() - timezone.timedelta(days=1),
            valid_to=timezone.now() + timezone.timedelta(days=30),
            is_active=True
        )
        
        # Create some payments for testing
        self.payment1 = Payment.objects.create(
            reference='API_TEST_001',
            amount=Decimal('5000.00'),
            currency='NGN',
            ticket=self.ticket,
            description='API test payment 1',
            payer_email=self.coordinator.email,
            payer_name=self.coordinator.full_name,
            status=Payment.Status.SUCCESS,
            completed_at=timezone.now()
        )
        
        self.payment2 = Payment.objects.create(
            reference='API_TEST_002',
            amount=Decimal('5000.00'),
            currency='NGN',
            ticket=self.ticket,
            description='API test payment 2',
            payer_email=self.regular_user.email,
            payer_name=self.regular_user.full_name,
            status=Payment.Status.PENDING
        )
    
    def test_list_payments_as_admin(self):
        """Test listing payments as admin"""
        
        self.client.force_authenticate(user=self.admin)
        
        # Using your actual URL pattern
        response = self.client.get('/api/payments/payments/')
        
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check response structure
        self.assertGreaterEqual(len(result_list(response)), 2)

    
    def test_list_payments_as_coordinator(self):
        """Test listing payments as coordinator"""
        
        self.client.force_authenticate(user=self.coordinator)
        
        response = self.client.get('/api/payments/payments/')
        
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Coordinator receives a readable, list-shaped payments payload.
        # (Province-scoped visibility is not yet enforced; see audit C2.)
        self.assertIsInstance(result_list(response), list)


    def test_my_payments_endpoint(self):
        """Test my_payments endpoint"""
        
        self.client.force_authenticate(user=self.coordinator)
        
        response = self.client.get('/api/payments/payments/my_payments/')
        
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # All payments should belong to the coordinator
        for payment in result_list(response):
            self.assertEqual(payment['payer_email'], self.coordinator.email)

    
    @patch('payments.services.SquadService.open_checkout')
    @patch('payments.services.SquadService.generate_reference')
    def test_initialize_payment_endpoint(self, mock_generate_ref, mock_initialize):
        """Test initialize payment endpoint"""
        
        self.client.force_authenticate(user=self.coordinator)

        # Mock responses
        mock_generate_ref.return_value = 'RCCGTESTREF'
        mock_initialize.return_value = 'https://sandbox-pay.squadco.com/RCCGTESTREF'

        # A fresh ticket with no prior payment: self.ticket already carries a
        # SUCCESS payment from setUp, and the endpoint (correctly) refuses to
        # initialize a second payment for an already-paid ticket.
        unpaid_ticket = Ticket.objects.create(
            full_name='Unpaid Teen',
            age=15,
            category=Ticket.Category.TEENS,
            gender=Ticket.Gender.MALE,
            phone='+2348012345671',
            email='unpaid@example.com',
            province='lagos_province_9',
            zone='Zone B',
            area='Area 2',
            parish='Parish ABC',
            emergency_contact='Emergency',
            emergency_phone='+2348023456701',
            emergency_relationship='Sister',
            parent_name='Parent',
            parent_email='parent_unpaid@example.com',
            parent_phone='+2348023456701',
            parent_relationship='Parent',
            registered_by=self.coordinator
        )

        # Make request to your actual endpoint
        response = self.client.post(
            '/api/payments/payments/initialize/',
            {
                'ticket_id': str(unpaid_ticket.id),
                'payment_plan_id': str(self.payment_plan.id)
            },
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        # Check response structure
        self.assertIn('payment', response.data)
        self.assertEqual(response.data['authorization_url'], 'https://sandbox-pay.squadco.com/RCCGTESTREF')
        self.assertIn('reference', response.data)

        # Verify payment was created in database
        payment_ref = response.data['reference']
        payment = Payment.objects.get(reference=payment_ref)


        self.assertEqual(payment.ticket, unpaid_ticket)
        self.assertEqual(payment.payer_email, self.coordinator.email)
        self.assertEqual(payment.status, Payment.Status.PENDING)
        
    
    def test_payment_plans_listing(self):
        """Test listing payment plans"""
        
        # This endpoint should be public
        response = self.client.get('/api/payments/payment-plans/')
        
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Should see active payment plans
        self.assertGreaterEqual(len(result_list(response)), 1)

    
    def test_create_payment_plan_as_admin(self):
        """Test creating payment plan as admin"""
        
        self.client.force_authenticate(user=self.admin)
        
        plan_data = {
            'name': 'VIP Package',
            'plan_type': PaymentPlan.PlanType.VIP,
            'description': 'VIP access with special privileges',
            'amount': '10000.00',
            'currency': 'NGN',
            'valid_from': timezone.now().isoformat(),
            'valid_to': (timezone.now() + timezone.timedelta(days=30)).isoformat(),
            'ticket_category': Ticket.Category.TEENS,
            'max_usage': 50,
            'is_active': True
        }
        
        response = self.client.post(
            '/api/payments/payment-plans/',
            plan_data,
            format='json'
        )
        
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'VIP Package')
        self.assertEqual(response.data['amount'], '10000.00')
        self.assertEqual(response.data['plan_type'], PaymentPlan.PlanType.VIP)
        
    
    def test_create_payment_plan_as_non_admin(self):
        """Test creating payment plan as non-admin (should fail)"""
        
        self.client.force_authenticate(user=self.coordinator)
        
        plan_data = {
            'name': 'Test Plan',
            'amount': '5000.00',
            'valid_from': timezone.now().isoformat(),
            'valid_to': (timezone.now() + timezone.timedelta(days=30)).isoformat(),
        }
        
        response = self.client.post(
            '/api/payments/payment-plans/',
            plan_data,
            format='json'
        )
        
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        


class PaymentDashboardTests(APITestCase):
    """Tests for payment dashboard using actual implementation"""
    
    def setUp(self):
        # Create admin user
        self.admin = User.objects.create_superuser(
            username='dashboard_admin',
            email='dashboard@rccg.com',
            password='adminpass',
            first_name='Dashboard',
            last_name='Admin'
        )
        
        # Create coordinator
        self.coordinator = User.objects.create_user(
            username='dashboard_coord',
            email='dashboard_coord@rccg.com',
            password='coordpass',
            first_name='Dashboard',
            last_name='Coord',
            role=User.Role.COORDINATOR,
            province=User.Province.LAGOS_PROVINCE_9
        )
        
        # Create tickets and payments
        self.ticket = Ticket.objects.create(
            full_name='Dashboard Teen',
            age=16,
            category=Ticket.Category.TEENS,
            gender=Ticket.Gender.FEMALE,
            phone='+2348012345000',
            email='dashboard@example.com',
            province='lagos_province_9',
            zone='Zone C',
            area='Area 3',
            parish='Parish Dashboard',
            emergency_contact='Dashboard Contact',
            emergency_phone='+2348023456000',
            emergency_relationship='Guardian',
            parent_name='Dashboard Parent',
            parent_email='dashboard_parent@example.com',
            parent_phone='+2348023456000',
            parent_relationship='Parent',
            registered_by=self.coordinator
        )
        
        # Create payments with different statuses and methods
        Payment.objects.create(
            reference='DASH_001',
            amount=Decimal('5000.00'),
            currency='NGN',
            ticket=self.ticket,
            description='Dashboard test 1',
            payer_email='payer1@example.com',
            status=Payment.Status.SUCCESS,
            payment_method=Payment.PaymentMethod.CARD,
            completed_at=timezone.now()
        )
        
        Payment.objects.create(
            reference='DASH_002',
            amount=Decimal('5000.00'),
            currency='NGN',
            ticket=self.ticket,
            description='Dashboard test 2',
            payer_email='payer2@example.com',
            status=Payment.Status.SUCCESS,
            payment_method=Payment.PaymentMethod.BANK_TRANSFER,
            completed_at=timezone.now()
        )
        
        Payment.objects.create(
            reference='DASH_003',
            amount=Decimal('5000.00'),
            currency='NGN',
            ticket=self.ticket,
            description='Dashboard test 3',
            payer_email='payer3@example.com',
            status=Payment.Status.PENDING
        )
        
        Payment.objects.create(
            reference='DASH_004',
            amount=Decimal('3000.00'),
            currency='NGN',
            ticket=self.ticket,
            description='Dashboard test 4',
            payer_email='payer4@example.com',
            status=Payment.Status.FAILED,
            completed_at=timezone.now()
        )
    
    def test_payment_dashboard_as_admin(self):
        """Test payment dashboard access as admin"""
        
        self.client.force_authenticate(user=self.admin)
        
        response = self.client.get('/api/payments/dashboard/')
        
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check dashboard structure
        data = response.data
        self.assertIn('overview', data)
        self.assertIn('revenue', data)
        self.assertIn('payment_methods', data)
        self.assertIn('recent_payments', data)
        
        # Check overview stats
        overview = data['overview']
        
        self.assertEqual(overview['total_payments'], 4)
        self.assertEqual(overview['successful_payments'], 2)
        self.assertEqual(overview['pending_payments'], 1)
        self.assertEqual(overview['failed_payments'], 1)
        
        # Check revenue
        revenue = data['revenue']
        
        self.assertEqual(float(revenue['total']), 10000.00)  # 2 successful payments * 5000
        
        # Check payment methods
        methods = data['payment_methods']
        self.assertEqual(len(methods), 2)  # CARD and BANK_TRANSFER
        
    
    def test_payment_dashboard_as_non_admin(self):
        """Test payment dashboard access as non-admin (should fail)"""
        
        self.client.force_authenticate(user=self.coordinator)
        
        response = self.client.get('/api/payments/dashboard/')
        
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        


class TransactionLogTests(TestCase):
    """Tests for TransactionLog model"""
    
    def test_create_transaction_log(self):
        """Test creating transaction logs"""
        
        # Create a payment
        user = User.objects.create_user(
            username='loguser',
            email='log@rccg.com',
            password='testpass',
            first_name='Log',
            last_name='User'
        )
        
        payment = Payment.objects.create(
            reference='LOG_TEST_001',
            amount=Decimal('2000.00'),
            currency='NGN',
            description='Log test',
            payer_email='log@example.com',
            status=Payment.Status.PENDING
        )
        
        # Create transaction log
        log = TransactionLog.objects.create(
            payment=payment,
            transaction_type=TransactionLog.TransactionType.INITIATE,
            request_data={'amount': 200000, 'email': 'test@example.com'},
            response_data={'status': True, 'message': 'Success'},
            is_successful=True,
            ip_address='127.0.0.1',
            user_agent='TestClient/1.0'
        )
        
        
        self.assertEqual(log.payment, payment)
        self.assertEqual(log.transaction_type, TransactionLog.TransactionType.INITIATE)
        self.assertTrue(log.is_successful)
        self.assertEqual(log.ip_address, '127.0.0.1')
        


def squad_signature(raw_body, secret='sandbox_sk_dummy'):
    """The `x-squad-encrypted-body` Squad would send for `raw_body`: in capitals."""
    import hashlib
    import hmac
    return hmac.new(secret.encode('utf-8'), raw_body, hashlib.sha512).hexdigest().upper()


@squad_test_keys
class SquadWebhookTests(APITestCase):
    """The webhook is unauthenticated: the signature is its only guard."""

    url = '/api/v1/payments/webhook'

    def setUp(self):
        self.payment = Payment.objects.create(
            reference='WEBHOOK_TEST_001',
            amount=Decimal('3000.00'),
            currency='NGN',
            description='Webhook test',
            payer_email='payer@rccg.com',
            status=Payment.Status.PENDING,
        )

    def body(self, amount=300000, event='charge_successful'):
        return squad_webhook(self.payment.reference, amount=amount, event=event)

    def post(self, raw_body, signature=None):
        headers = {}
        if signature is not None:
            headers['HTTP_X_SQUAD_ENCRYPTED_BODY'] = signature
        return self.client.post(
            self.url, data=raw_body, content_type='application/json', **headers)

    def status_now(self):
        self.payment.refresh_from_db()
        return self.payment.status

    def test_missing_signature_is_refused(self):
        response = self.post(self.body())

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.status_now(), Payment.Status.PENDING)

    def test_forged_signature_is_refused_and_not_logged(self):
        response = self.post(self.body(), signature='anything')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.status_now(), Payment.Status.PENDING)
        self.assertFalse(TransactionLog.objects.exists())

    def test_signature_for_a_different_body_is_refused(self):
        signature = squad_signature(self.body(amount=100))

        response = self.post(self.body(), signature=signature)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.status_now(), Payment.Status.PENDING)

    def test_genuine_event_completes_the_payment(self):
        raw = self.body()

        response = self.post(raw, signature=squad_signature(raw))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.status_now(), Payment.Status.SUCCESS)

    @patch('tickets.services.EmailService.send_payment_confirmation')
    def test_a_retried_event_sends_one_email(self, mock_email):
        raw = self.body()
        signature = squad_signature(raw)

        with self.captureOnCommitCallbacks(execute=True):
            first = self.post(raw, signature=signature)
        with self.captureOnCommitCallbacks(execute=True):
            second = self.post(raw, signature=signature)

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(self.status_now(), Payment.Status.SUCCESS)
        mock_email.assert_called_once()

    def test_wrong_amount_does_not_complete_the_payment(self):
        raw = self.body(amount=100)

        response = self.post(raw, signature=squad_signature(raw))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.status_now(), Payment.Status.PENDING)

    def test_a_replayed_success_does_not_revive_a_refund(self):
        Payment.objects.filter(pk=self.payment.pk).update(status=Payment.Status.REFUNDED)
        raw = self.body()

        self.post(raw, signature=squad_signature(raw))

        self.assertEqual(self.status_now(), Payment.Status.REFUNDED)

    @patch('tickets.services.EmailService.send_payment_confirmation')
    @patch.object(SquadService, 'verify_payment')
    def test_verify_after_the_webhook_changes_nothing(self, mock_verify, mock_email):
        raw = self.body()
        with self.captureOnCommitCallbacks(execute=True):
            self.post(raw, signature=squad_signature(raw))
        mock_verify.return_value = squad_charge(self.payment.reference)

        with self.captureOnCommitCallbacks(execute=True):
            payment = PaymentService().verify_and_complete_payment(self.payment.reference)

        self.assertEqual(payment.status, Payment.Status.SUCCESS)
        mock_email.assert_called_once()

    @patch.object(SquadService, 'verify_payment')
    def test_a_late_abandoned_answer_does_not_undo_a_success(self, mock_verify):
        raw = self.body()
        self.post(raw, signature=squad_signature(raw))
        mock_verify.return_value = squad_charge(self.payment.reference, status='Abandoned')

        with self.assertRaises(Exception):
            PaymentService().verify_and_complete_payment(self.payment.reference)

        self.assertEqual(self.status_now(), Payment.Status.SUCCESS)

    def test_a_signature_that_is_not_ascii_is_refused_not_an_error(self):
        response = self.post(self.body(), signature='caf\u00e9')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(self.status_now(), Payment.Status.PENDING)

    def test_the_signature_is_accepted_in_either_case(self):
        raw = self.body()

        response = self.post(raw, signature=squad_signature(raw).lower())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.status_now(), Payment.Status.SUCCESS)

    def test_squads_own_reference_and_the_channel_are_kept(self):
        raw = self.body()

        self.post(raw, signature=squad_signature(raw))

        self.payment.refresh_from_db()
        self.assertEqual(self.payment.gateway_reference, 'WEBHOOK_TEST_001_1_1')
        self.assertEqual(self.payment.payment_method, Payment.PaymentMethod.CARD)

    def test_an_event_that_is_not_a_successful_charge_changes_nothing(self):
        raw = self.body(event='something_else')

        response = self.post(raw, signature=squad_signature(raw))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.status_now(), Payment.Status.PENDING)


@squad_test_keys
class SquadServiceTests(TestCase):
    """What is sent to Squad and how its answers are read. No request leaves."""

    @staticmethod
    def answer(status_code, body):
        response = Mock(status_code=status_code, text=json.dumps(body))
        response.json.return_value = body
        return response

    @patch('payments.services.requests.request')
    def test_a_checkout_is_opened_for_the_price_with_no_fee_passed_on(self, mock_request):
        mock_request.return_value = self.answer(200, {
            'status': 200, 'message': 'success',
            'data': {'checkout_url': 'https://sandbox-pay.squadco.com/REF1'}})

        checkout_url = SquadService().open_checkout(
            reference='REF1', amount=Decimal('5000.00'), email='ada@example.com',
            name='Ada Obi', callback_url='https://api.example.com/back/REF1/')

        self.assertEqual(checkout_url, 'https://sandbox-pay.squadco.com/REF1')
        self.assertEqual(
            mock_request.call_args.args,
            ('POST', 'https://sandbox-api-d.squadco.com/transaction/initiate'))
        sent = mock_request.call_args.kwargs
        self.assertEqual(sent['headers']['Authorization'], 'Bearer sandbox_sk_dummy')
        self.assertEqual(sent['json']['amount'], 500000)  # kobo
        self.assertIs(sent['json']['pass_charge'], False)
        self.assertEqual(sent['json']['transaction_ref'], 'REF1')
        self.assertEqual(sent['json']['callback_url'], 'https://api.example.com/back/REF1/')
        self.assertTrue(TransactionLog.objects.get().is_successful)

    @override_settings(SQUAD_SECRET_KEY='sk_live_dummy')
    def test_a_live_key_is_sent_to_live(self):
        self.assertEqual(SquadService().base_url, 'https://api-d.squadco.com')

    @override_settings(SQUAD_SECRET_KEY='')
    def test_no_key_is_refused(self):
        with self.assertRaises(ValueError):
            SquadService()

    @patch('payments.services.requests.request')
    def test_verify_reads_squads_names(self, mock_request):
        mock_request.return_value = self.answer(200, {
            'status': 200, 'success': True, 'message': 'Success',
            'data': {
                'transaction_amount': 500000,
                'transaction_ref': 'REF1',
                'transaction_status': 'Success',
                'transaction_type': 'Transfer',
                'gateway_transaction_ref': 'REF1_5_5_1',
            }})

        charge = SquadService().verify_payment('REF1')

        self.assertEqual(
            mock_request.call_args.args,
            ('GET', 'https://sandbox-api-d.squadco.com/transaction/verify/REF1'))
        self.assertEqual(charge['reference'], 'REF1')
        self.assertEqual(charge['status'], 'success')
        self.assertEqual(charge['amount'], 500000)
        self.assertEqual(charge['gateway_reference'], 'REF1_5_5_1')
        self.assertEqual(charge['channel'], 'transfer')

    @patch('payments.services.requests.request')
    def test_a_refusal_is_an_error_and_is_logged(self, mock_request):
        mock_request.return_value = self.answer(400, {
            'status': 400, 'success': False,
            'message': 'Invalid transaction reference', 'data': {}})

        with self.assertRaises(SquadError):
            SquadService().verify_payment('NOPE')

        self.assertFalse(TransactionLog.objects.get().is_successful)
