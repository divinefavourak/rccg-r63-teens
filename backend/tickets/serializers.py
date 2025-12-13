from rest_framework import serializers
from django.core.validators import EmailValidator
from .models import Ticket, BulkUpload, TicketAuditLog, CheckInRecord
from users.models import User


class TicketSerializer(serializers.ModelSerializer):
    """Serializer for Ticket model"""
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    gender_display = serializers.CharField(source='get_gender_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    registered_by_name = serializers.CharField(source='registered_by.get_display_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_display_name', read_only=True, allow_null=True)
    age_group = serializers.CharField(source='get_age_group', read_only=True)
    
    id = serializers.UUIDField(format='hex_verbose', read_only=True)
    registered_by = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True
    )
    approved_by = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = Ticket
        fields = [
            'id', 'ticket_id', 'full_name', 'age', 'age_group', 'category', 'category_display',
            'gender', 'gender_display', 'date_of_birth', 'phone', 'email',
            'province', 'zone', 'area', 'parish', 'department',
            'medical_conditions', 'medications', 'dietary_restrictions',
            'emergency_contact', 'emergency_phone', 'emergency_relationship',
            'parent_name', 'parent_email', 'parent_phone', 'parent_relationship',
            'status', 'status_display', 'notes',
            'registered_at', 'registered_by', 'registered_by_name',
            'approved_at', 'approved_by', 'approved_by_name',
            'created_at', 'updated_at', 'qr_code',
            'payment_status', 'proof_of_payment'
        ]
        read_only_fields = [
            'id', 'ticket_id', 'registered_at', 'registered_by',
            'approved_at', 'approved_by', 'created_at', 'updated_at',
            'qr_code', 'payment_status', 'proof_of_payment'
        ]
    
    def validate(self, data):
        """Additional validation logic"""
        age = data.get('age', self.instance.age if self.instance else None)
        category = data.get('category', self.instance.category if self.instance else None)
        
        if age and category:
            # ✅ Added validation for new categories
            if category == 'toddler' and not (1 <= age <= 5):
                 raise serializers.ValidationError({'age': 'Toddlers must be between 1 and 5 years old.'})
            elif category == 'children_6_8' and not (6 <= age <= 8):
                 raise serializers.ValidationError({'age': 'Children must be between 6 and 8 years old.'})
            elif category == Ticket.Category.PRE_TEENS and not (8 <= age <= 12):
                raise serializers.ValidationError({'age': 'Pre-Teens must be between 8 and 12 years old.'})
            elif category == Ticket.Category.TEENS and not (13 <= age <= 19):
                raise serializers.ValidationError({'age': 'Teens must be between 13 and 19 years old.'})
        
        return data


class TicketCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating tickets"""
    
    class Meta:
        model = Ticket
        fields = [
            'full_name', 'age', 'category', 'gender', 'date_of_birth',
            'phone', 'email', 'province', 'zone', 'area', 'parish', 'department',
            'medical_conditions', 'medications', 'dietary_restrictions',
            'emergency_contact', 'emergency_phone', 'emergency_relationship',
            'parent_name', 'parent_email', 'parent_phone', 'parent_relationship',
            'notes'
        ]
        extra_kwargs = {
            'full_name': {'required': True},
            'age': {'required': True},
            'category': {'required': True},
            'gender': {'required': True},
            'phone': {'required': True},
            'email': {'required': False, 'allow_blank': True}, # ✅ Made email optional
            'province': {'required': True},
            'zone': {'required': True},
            'area': {'required': True},
            'parish': {'required': True},
            'emergency_contact': {'required': True},
            'emergency_phone': {'required': True},
            'emergency_relationship': {'required': True},
            'parent_name': {'required': True},
            'parent_email': {'required': True},
            'parent_phone': {'required': True},
            'parent_relationship': {'required': True},
        }
    
    def validate_email(self, value):
        if value:
            validator = EmailValidator()
            validator(value)
        return value
    
    def validate_parent_email(self, value):
        validator = EmailValidator()
        validator(value)
        return value


class TicketUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating tickets"""
    class Meta:
        model = Ticket
        fields = [
            'full_name', 'age', 'category', 'gender', 'date_of_birth',
            'phone', 'email', 'province', 'zone', 'area', 'parish', 'department',
            'medical_conditions', 'medications', 'dietary_restrictions',
            'emergency_contact', 'emergency_phone', 'emergency_relationship',
            'parent_name', 'parent_email', 'parent_phone', 'parent_relationship',
            'notes'
        ]


class TicketStatusUpdateSerializer(serializers.Serializer):
    """Serializer for updating ticket status"""
    status = serializers.ChoiceField(choices=Ticket.Status.choices)
    notes = serializers.CharField(required=False, allow_blank=True)
    
    def validate(self, data):
        ticket = self.context.get('ticket')
        user = self.context.get('user')
        
        if not ticket or not user:
            raise serializers.ValidationError("Ticket and user context required.")
        
        if data['status'] == Ticket.Status.APPROVED and not user.is_admin:
            raise serializers.ValidationError("Only administrators can approve tickets.")
        
        return data


class TicketPaymentUploadSerializer(serializers.ModelSerializer):
    """Serializer for uploading payment proof"""
    proof_of_payment = serializers.FileField(required=True)
    
    class Meta:
        model = Ticket
        fields = ['proof_of_payment']


class BulkUploadSerializer(serializers.ModelSerializer):
    """Serializer for bulk uploads"""
    uploaded_by_name = serializers.CharField(source='uploaded_by.get_display_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = BulkUpload
        fields = [
            'id', 'filename', 'uploaded_by', 'uploaded_by_name',
            'total_records', 'successful_records', 'failed_records',
            'status', 'status_display', 'error_log',
            'created_at', 'processed_at'
        ]
        read_only_fields = [
            'id', 'filename', 'uploaded_by', 'total_records',
            'successful_records', 'failed_records', 'status',
            'error_log', 'processed_at'
        ]


class BulkUploadCreateSerializer(serializers.Serializer):
    """Serializer for creating bulk uploads"""
    file = serializers.FileField()
    
    def validate_file(self, value):
        if not value.name.endswith('.csv'):
            raise serializers.ValidationError("Only CSV files are allowed.")
        
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("File size must not exceed 5MB.")
        
        return value


class TicketAuditLogSerializer(serializers.ModelSerializer):
    """Serializer for ticket audit logs"""
    user_display = serializers.SerializerMethodField()
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    ticket_id_display = serializers.SerializerMethodField()
    
    class Meta:
        model = TicketAuditLog
        fields = [
            'id', 'user_display', 'action', 'action_display',
            'ticket_id_display', 'bulk_upload',
            'old_values', 'new_values', 'ip_address', 'user_agent',
            'timestamp'
        ]
        read_only_fields = fields
    
    def get_user_display(self, obj):
        return obj.user.get_display_name() if obj.user else 'System'
    
    def get_ticket_id_display(self, obj):
        return obj.ticket.ticket_id if obj.ticket else None


class CheckInRecordSerializer(serializers.ModelSerializer):
    """Serializer for check-in records"""
    ticket_id_display = serializers.CharField(source='ticket.ticket_id', read_only=True)
    ticket_full_name = serializers.CharField(source='ticket.full_name', read_only=True)
    checked_by_name = serializers.CharField(source='checked_in_by.get_display_name', read_only=True)
    check_in_method_display = serializers.CharField(source='get_check_in_method_display', read_only=True)
    
    class Meta:
        model = CheckInRecord
        fields = [
            'id', 'ticket', 'ticket_id_display', 'ticket_full_name',
            'checked_in_by', 'checked_by_name', 'checked_in_at',
            'check_in_method', 'check_in_method_display', 'notes',
            'location_lat', 'location_long', 'ip_address', 'user_agent',
            'device_id'
        ]
        read_only_fields = [
            'id', 'checked_in_at', 'ip_address', 'user_agent'
        ]