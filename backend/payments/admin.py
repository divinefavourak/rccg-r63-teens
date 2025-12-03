from django.contrib import admin
from .models import Payment, PaymentPlan, TransactionLog


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('reference', 'amount', 'status', 'payer_email', 'initiated_at', 'completed_at')
    list_filter = ('status', 'payment_method', 'initiated_at')
    search_fields = ('reference', 'payer_email', 'payer_name', 'description')
    readonly_fields = ('reference', 'paystack_reference', 'initiated_at', 'completed_at', 'updated_at')
    fieldsets = (
        ('Payment Information', {
            'fields': ('reference', 'paystack_reference', 'amount', 'currency', 'status', 'payment_method')
        }),
        ('Details', {
            'fields': ('ticket', 'description', 'payer_email', 'payer_name', 'payer_phone')
        }),
        ('Paystack Data', {
            'fields': ('authorization_code', 'channel', 'paystack_response', 'metadata'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('initiated_at', 'completed_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(PaymentPlan)
class PaymentPlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'plan_type', 'amount', 'is_active', 'valid_from', 'valid_to', 'usage_count')
    list_filter = ('plan_type', 'is_active', 'ticket_category')
    search_fields = ('name', 'description')
    readonly_fields = ('usage_count', 'created_at', 'updated_at')


@admin.register(TransactionLog)
class TransactionLogAdmin(admin.ModelAdmin):
    list_display = ('transaction_type', 'is_successful', 'timestamp')
    list_filter = ('transaction_type', 'is_successful', 'timestamp')
    search_fields = ('payment__reference', 'error_message')
    readonly_fields = ('timestamp',)
    date_hierarchy = 'timestamp'