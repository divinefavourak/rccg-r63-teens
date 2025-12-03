from rest_framework import serializers
from .models import Payment, PaymentPlan
from tickets.serializers import TicketSerializer
from users.serializers import UserSerializer


class PaymentPlanSerializer(serializers.ModelSerializer):
    """Serializer for PaymentPlan"""
    formatted_amount = serializers.CharField(read_only=True)
    is_valid = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = PaymentPlan
        fields = [
            'id', 'name', 'plan_type', 'description',
            'amount', 'formatted_amount', 'currency',
            'is_active', 'valid_from', 'valid_to',
            'ticket_category', 'max_usage', 'usage_count',
            'is_valid', 'created_at', 'updated_at'
        ]
        read_only_fields = ['usage_count', 'created_at', 'updated_at']


class PaymentSerializer(serializers.ModelSerializer):
    """Serializer for Payment"""
    formatted_amount = serializers.CharField(read_only=True)
    is_successful = serializers.BooleanField(read_only=True)
    is_pending = serializers.BooleanField(read_only=True)
    ticket_details = TicketSerializer(source='ticket', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    
    class Meta:
        model = Payment
        fields = [
            'id', 'reference', 'paystack_reference',
            'amount', 'formatted_amount', 'currency',
            'status', 'status_display', 'payment_method', 'payment_method_display',
            'ticket', 'ticket_details', 'description',
            'payer_email', 'payer_name', 'payer_phone',
            'authorization_code', 'channel',
            'is_successful', 'is_pending',
            'initiated_at', 'completed_at', 'updated_at',
            'metadata', 'paystack_response'
        ]
        read_only_fields = [
            'id', 'reference', 'paystack_reference',
            'amount', 'currency', 'status', 'payment_method',
            'authorization_code', 'channel',
            'initiated_at', 'completed_at', 'updated_at',
            'paystack_response'
        ]


class InitializePaymentSerializer(serializers.Serializer):
    """Serializer for initializing payment"""
    ticket_id = serializers.UUIDField(required=True)
    payment_plan_id = serializers.UUIDField(required=False, allow_null=True)
    
    def validate(self, data):
        # Add validation logic here
        return data


class PaystackCallbackSerializer(serializers.Serializer):
    """Serializer for Paystack callback"""
    reference = serializers.CharField(required=True)
    trxref = serializers.CharField(required=False)
    transaction = serializers.DictField(required=False)


class WebhookSerializer(serializers.Serializer):
    """Serializer for Paystack webhook"""
    event = serializers.CharField(required=True)
    data = serializers.DictField(required=True)