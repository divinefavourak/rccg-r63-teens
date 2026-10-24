from rest_framework import serializers
from .models import Payment, PaymentPlan, PaymentReceipt
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
            'id', 'reference', 'gateway_reference',
            'amount', 'formatted_amount', 'currency',
            'status', 'status_display', 'payment_method', 'payment_method_display',
            'ticket', 'ticket_details', 'description',
            'payer_email', 'payer_name', 'payer_phone',
            'authorization_code', 'channel',
            'is_successful', 'is_pending',
            'initiated_at', 'completed_at', 'updated_at',
            'metadata', 'gateway_response'
        ]
        read_only_fields = [
            'id', 'reference', 'gateway_reference',
            'amount', 'currency', 'status', 'payment_method',
            'authorization_code', 'channel',
            'initiated_at', 'completed_at', 'updated_at',
            'gateway_response'
        ]


class InitializePaymentSerializer(serializers.Serializer):
    """Serializer for initializing payment (Single or Bulk)"""
    ticket_id = serializers.UUIDField(required=False)
    ticket_ids = serializers.ListField(child=serializers.UUIDField(), required=False)
    payment_plan_id = serializers.UUIDField(required=False, allow_null=True)
    
    def validate(self, data):
        # Ensure at least one ticket identifier is present
        if not data.get('ticket_id') and not data.get('ticket_ids'):
            raise serializers.ValidationError("Either ticket_id or ticket_ids is required.")
        return data


# =====================
# TRANSFER RECEIPTS AND THE LEDGER
# =====================

class PaymentReceiptSerializer(serializers.ModelSerializer):
    """A receipt, and enough about what it pays for to check it."""

    submitted_by_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    target = serializers.SerializerMethodField()
    duplicates = serializers.SerializerMethodField()

    def get_submitted_by_name(self, obj):
        return obj.submitted_by.get_full_name() if obj.submitted_by else ''

    def get_reviewed_by_name(self, obj):
        return obj.reviewed_by.get_full_name() if obj.reviewed_by else ''

    def get_file_url(self, obj):
        # Never the storage address: the file is only handed out by the
        # endpoint that checks who is asking.
        path = f'/api/v1/payments/receipts/{obj.pk}/file/'
        request = self.context.get('request')
        return request.build_absolute_uri(path) if request else path

    def get_target(self, obj):
        event = obj.event
        base = {'event': str(event.pk), 'event_title': event.title}
        if obj.batch_id:
            batch = obj.batch
            return {
                **base, 'kind': 'batch', 'id': str(batch.pk), 'reference': batch.reference,
                'node': batch.node.name, 'headcount': batch.headcount,
                'amount_due': str(batch.amount_due), 'amount_paid': str(batch.amount_paid),
                'balance': str(batch.balance), 'status': batch.status,
            }
        registration = obj.registration
        return {
            **base, 'kind': 'registration', 'id': str(registration.pk),
            'reference': registration.registration_id, 'attendee_name': registration.attendee_name,
            'node': registration.node.name if registration.node_id else '',
            'amount_due': str(registration.amount_due or 0),
            'amount_paid': str(registration.amount_paid or 0),
            'status': registration.payment_status,
        }

    def get_duplicates(self, obj):
        from . import receipts
        return [
            {'id': str(other.pk), 'status': other.status,
             'same_file': other.file_sha256 == obj.file_sha256,
             'created_at': other.created_at}
            for other in receipts.duplicates(obj)[:5]
        ]

    class Meta:
        model = PaymentReceipt
        fields = [
            'id', 'batch', 'registration', 'target', 'submitted_by', 'submitted_by_name',
            'amount_claimed', 'paid_on', 'payer_name', 'bank_reference', 'file_url',
            'file_name', 'file_type', 'status', 'amount_verified', 'reviewed_by',
            'reviewed_by_name', 'reviewed_at', 'review_note', 'payment', 'duplicates',
            'created_at',
        ]
        read_only_fields = fields


class PaymentReceiptCreateSerializer(serializers.Serializer):
    """`batch` or `registration`, and the transfer."""

    batch = serializers.UUIDField(required=False)
    registration = serializers.UUIDField(required=False)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=1)
    paid_on = serializers.DateField()
    payer_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    bank_reference = serializers.CharField(max_length=100, required=False, allow_blank=True)
    file = serializers.FileField()

    def validate(self, data):
        if bool(data.get('batch')) == bool(data.get('registration')):
            raise serializers.ValidationError(
                'Say what the receipt is for: a group or a registration.')
        return data


class ReceiptVerifySerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=1, required=False)
    note = serializers.CharField(required=False, allow_blank=True)


class ReceiptRejectSerializer(serializers.Serializer):
    reason = serializers.CharField()


class LedgerPaymentSerializer(serializers.ModelSerializer):
    """One line of money received for an event, online or by transfer."""

    kind = serializers.SerializerMethodField()
    for_reference = serializers.SerializerMethodField()
    node = serializers.SerializerMethodField()
    bank_reference = serializers.SerializerMethodField()
    receipt = serializers.SerializerMethodField()

    def get_kind(self, obj):
        return 'manual' if obj.channel == 'manual_transfer' else 'online'

    def get_for_reference(self, obj):
        if obj.batch_id:
            return obj.batch.reference
        return obj.registration.registration_id if obj.registration_id else ''

    def get_node(self, obj):
        node = obj.batch.node if obj.batch_id else (
            obj.registration.node if obj.registration_id else None)
        return node.name if node else ''

    def get_bank_reference(self, obj):
        return (obj.metadata or {}).get('bank_reference', '')

    def get_receipt(self, obj):
        return (obj.metadata or {}).get('receipt_id')

    class Meta:
        model = Payment
        fields = [
            'id', 'reference', 'amount', 'status', 'kind', 'channel', 'payment_method',
            'payer_name', 'payer_email', 'batch', 'registration', 'for_reference', 'node',
            'bank_reference', 'receipt', 'completed_at', 'initiated_at',
        ]
        read_only_fields = fields
