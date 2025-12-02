import csv
import pandas as pd
from io import StringIO, TextIOWrapper
from django.utils import timezone
from django.db import transaction
from .models import Ticket, BulkUpload
from .serializers import TicketSerializer
import logging

logger = logging.getLogger(__name__)

class TicketService:
    @staticmethod
    def create_ticket(data, user):
        """Create a single ticket."""
        serializer = TicketSerializer(data=data, context={'request': None})
        if serializer.is_valid():
            ticket = serializer.save(registered_by=user)
            return ticket, None
        return None, serializer.errors
    
    @staticmethod
    def update_ticket_status(ticket, status, user, rejection_reason=None):
        """Update ticket status."""
        ticket.status = status
        if status == Ticket.Status.APPROVED:
            ticket.approved_by = user
            ticket.approved_at = timezone.now()
        elif status == Ticket.Status.REJECTED and rejection_reason:
            ticket.rejection_reason = rejection_reason
        ticket.save()
        return ticket


class BulkUploadService:
    @staticmethod
    def process_csv_file(file, user):
        """Process CSV file for bulk upload."""
        errors = []
        successful = 0
        failed = 0
        
        try:
            # Read CSV file
            csv_file = file.read().decode('utf-8').splitlines()
            reader = csv.DictReader(csv_file)
            rows = list(reader)
            
            total_records = len(rows)
            
            for i, row in enumerate(rows, start=1):
                try:
                    # Clean and validate row data
                    cleaned_data = BulkUploadService._clean_row_data(row)
                    
                    # Add required fields
                    cleaned_data['registered_by'] = user
                    # Use user's province for coordinators
                    if user.is_coordinator:
                        cleaned_data['province'] = user.province
                    
                    # Create ticket
                    ticket = Ticket.objects.create(**cleaned_data)
                    successful += 1
                    
                except Exception as e:
                    failed += 1
                    errors.append({
                        'row': i,
                        'errors': [str(e)],
                        'data': row
                    })
            
            return {
                'total': total_records,
                'successful': successful,
                'failed': failed,
                'errors': errors
            }
            
        except Exception as e:
            raise Exception(f"Failed to process CSV file: {str(e)}")

class DashboardService:
    @staticmethod
    def get_admin_stats():
        """Get statistics for admin dashboard."""
        from django.db.models import Count, Q
        
        tickets = Ticket.objects.all()
        
        return {
            'global_stats': {
                'total_tickets': tickets.count(),
                'pending_tickets': tickets.filter(status=Ticket.Status.PENDING).count(),
                'approved_tickets': tickets.filter(status=Ticket.Status.APPROVED).count(),
                'rejected_tickets': tickets.filter(status=Ticket.Status.REJECTED).count(),
                'pre_teens': tickets.filter(category=Ticket.Category.PRE_TEENS).count(),
                'teens': tickets.filter(category=Ticket.Category.TEENS).count(),
            },
            'province_stats': list(
                tickets.values('province')
                .annotate(
                    total=Count('id'),
                    pending=Count('id', filter=Q(status=Ticket.Status.PENDING)),
                    approved=Count('id', filter=Q(status=Ticket.Status.APPROVED)),
                    rejected=Count('id', filter=Q(status=Ticket.Status.REJECTED))
                )
                .order_by('province')
            )
        }
    
    @staticmethod
    def get_coordinator_stats(user):
        """Get statistics for coordinator dashboard."""
        tickets = Ticket.objects.filter(province=user.province)
        
        return {
            'stats': {
                'total_tickets': tickets.count(),
                'pending_tickets': tickets.filter(status=Ticket.Status.PENDING).count(),
                'approved_tickets': tickets.filter(status=Ticket.Status.APPROVED).count(),
                'rejected_tickets': tickets.filter(status=Ticket.Status.REJECTED).count(),
                'pre_teens': tickets.filter(category=Ticket.Category.PRE_TEENS).count(),
                'teens': tickets.filter(category=Ticket.Category.TEENS).count(),
            }
        }