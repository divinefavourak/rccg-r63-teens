from rest_framework import serializers
from django.utils import timezone
from .models import Ticket, BulkUpload

class TicketSerializer(serializers.ModelSerializer):
    registered_by_name = serializers.CharField(source='registered_by.name', read_only=True)
    registered_by_username = serializers.CharField(source='registered_by.username', read_only=True)
    
    class Meta:
        model = Ticket
        fields = '__all__'
        read_only_fields = ['ticket_id', 'registered_at', 'registered_by', 'created_at', 'updated_at']
    
    def validate(self, data):
        # Basic validation
        errors = {}
        
        # Age validation based on category
        age = data.get('age')
        category = data.get('category')
        
        if category == 'pre_teens' and not (8 <= age <= 12):
            errors['age'] = "Pre-teens must be between 8 and 12 years old"
        elif category == 'teens' and not (13 <= age <= 19):
            errors['age'] = "Teens must be between 13 and 19 years old"
        
        # Phone validation
        phone = data.get('phone', '')
        if not phone.isdigit() or len(phone) < 10:
            errors['phone'] = "Phone number must contain only digits and be at least 10 characters"
        
        # Emergency phone validation
        emergency_phone = data.get('emergency_phone', '')
        if not emergency_phone.isdigit() or len(emergency_phone) < 10:
            errors['emergency_phone'] = "Emergency phone must contain only digits and be at least 10 characters"
        
        # Parent phone validation
        parent_phone = data.get('parent_phone', '')
        if not parent_phone.isdigit() or len(parent_phone) < 10:
            errors['parent_phone'] = "Parent phone must contain only digits and be at least 10 characters"
        
        if errors:
            raise serializers.ValidationError(errors)
        
        return data
    
    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['registered_by'] = request.user
        return super().create(validated_data)


class TicketStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Ticket.Status.choices)
    rejection_reason = serializers.CharField(required=False, allow_blank=True)


class BulkUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = BulkUpload
        fields = ['upload_id', 'file', 'status', 'total_records', 
                 'successful_records', 'failed_records', 'errors', 'created_at']
        read_only_fields = ['upload_id', 'status', 'total_records', 
                          'successful_records', 'failed_records', 'errors', 'created_at']


class CSVUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    
    def validate_file(self, value):
        if not value.name.endswith('.csv'):
            raise serializers.ValidationError("Only CSV files are allowed")
        return value