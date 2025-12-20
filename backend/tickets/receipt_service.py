"""
Receipt Upload Service for R63 Teens Registration System

This service handles payment receipt uploads with validation,
file processing, and admin notifications.
"""

import os
import mimetypes
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.utils import timezone
from PIL import Image
import logging

logger = logging.getLogger(__name__)


class ReceiptUploadService:
    """Service for handling payment receipt uploads"""
    
    # Allowed file types for receipts
    ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.gif']
    ALLOWED_MIME_TYPES = [
        'application/pdf',
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif'
    ]
    
    # File size limits
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    
    @classmethod
    def validate_receipt_file(cls, uploaded_file):
        """
        Validate uploaded receipt file
        
        Args:
            uploaded_file: Django UploadedFile object
            
        Returns:
            dict: {'valid': bool, 'error': str or None}
        """
        # Check file size
        if uploaded_file.size > cls.MAX_FILE_SIZE:
            return {
                'valid': False,
                'error': f'File size ({uploaded_file.size / 1024 / 1024:.1f}MB) exceeds maximum allowed size (5MB)'
            }
        
        # Check file extension
        file_extension = os.path.splitext(uploaded_file.name)[1].lower()
        if file_extension not in cls.ALLOWED_EXTENSIONS:
            return {
                'valid': False,
                'error': f'File type {file_extension} not allowed. Allowed types: {", ".join(cls.ALLOWED_EXTENSIONS)}'
            }
        
        # Check MIME type
        mime_type, _ = mimetypes.guess_type(uploaded_file.name)
        if mime_type not in cls.ALLOWED_MIME_TYPES:
            return {
                'valid': False,
                'error': f'Invalid file type. Please upload a valid image or PDF file.'
            }
        
        # Additional validation for images
        if mime_type and mime_type.startswith('image/'):
            try:
                # Try to open and verify the image
                image = Image.open(uploaded_file)
                image.verify()
                
                # Reset file pointer after verification
                uploaded_file.seek(0)
                
                # Check image dimensions (optional)
                width, height = image.size
                if width < 100 or height < 100:
                    return {
                        'valid': False,
                        'error': 'Image is too small. Minimum size is 100x100 pixels.'
                    }
                    
            except Exception as e:
                return {
                    'valid': False,
                    'error': 'Invalid image file or corrupted image.'
                }
        
        return {'valid': True, 'error': None}
    
    @classmethod
    def process_receipt_upload(cls, ticket, uploaded_file, user=None):
        """
        Process receipt upload for a ticket
        
        Args:
            ticket: Ticket instance
            uploaded_file: Django UploadedFile object
            user: User who uploaded (optional)
            
        Returns:
            dict: {'success': bool, 'message': str, 'file_url': str or None}
        """
        try:
            # Validate file
            validation_result = cls.validate_receipt_file(uploaded_file)
            if not validation_result['valid']:
                return {
                    'success': False,
                    'message': validation_result['error'],
                    'file_url': None
                }
            
            # Generate unique filename
            timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
            file_extension = os.path.splitext(uploaded_file.name)[1].lower()
            filename = f"receipt_{ticket.ticket_id}_{timestamp}{file_extension}"
            
            # Save file
            file_path = f"payment_proofs/{filename}"
            saved_path = default_storage.save(file_path, uploaded_file)
            
            # Update ticket
            old_proof = ticket.proof_of_payment
            ticket.proof_of_payment = saved_path
            ticket.payment_status = ticket.PaymentStatus.VERIFICATION_PENDING
            ticket.save()
            
            # Delete old proof if exists
            if old_proof and default_storage.exists(old_proof.name):
                try:
                    default_storage.delete(old_proof.name)
                except Exception as e:
                    logger.warning(f"Failed to delete old receipt file: {e}")
            
            # Send notification to admins
            cls.notify_admins_of_receipt_upload(ticket, user)
            
            # Get file URL
            file_url = default_storage.url(saved_path) if saved_path else None
            
            logger.info(f"Receipt uploaded successfully for ticket {ticket.ticket_id}")
            
            return {
                'success': True,
                'message': 'Receipt uploaded successfully. Your payment is now pending verification.',
                'file_url': file_url
            }
            
        except Exception as e:
            logger.error(f"Error processing receipt upload for ticket {ticket.ticket_id}: {e}")
            return {
                'success': False,
                'message': 'An error occurred while uploading the receipt. Please try again.',
                'file_url': None
            }
    
    @classmethod
    def notify_admins_of_receipt_upload(cls, ticket, uploader=None):
        """
        Send notification email to admins about new receipt upload
        
        Args:
            ticket: Ticket instance
            uploader: User who uploaded (optional)
        """
        try:
            # Get admin emails
            from users.models import User
            admin_emails = list(
                User.objects.filter(
                    role__in=[User.Role.ADMIN, User.Role.COORDINATOR],
                    is_active=True
                ).values_list('email', flat=True)
            )
            
            if not admin_emails:
                logger.warning("No admin emails found for receipt upload notification")
                return
            
            subject = f"[R63 Teens] New Payment Receipt - {ticket.ticket_id}"
            
            context = {
                'ticket': ticket,
                'uploader': uploader,
                'upload_time': timezone.now(),
                'admin_url': f"{getattr(settings, 'FRONTEND_URL', '')}/admin/tickets/{ticket.id}",
                'receipt_url': ticket.proof_of_payment.url if ticket.proof_of_payment else None
            }
            
            # Create email content
            html_message = f"""
            <html>
            <body>
                <h2>New Payment Receipt Uploaded</h2>
                <p>A payment receipt has been uploaded for verification.</p>
                
                <h3>Ticket Details:</h3>
                <ul>
                    <li><strong>Ticket ID:</strong> {ticket.ticket_id}</li>
                    <li><strong>Name:</strong> {ticket.full_name}</li>
                    <li><strong>Category:</strong> {ticket.get_category_display()}</li>
                    <li><strong>Province:</strong> {ticket.province}</li>
                    <li><strong>Parish:</strong> {ticket.parish}</li>
                    <li><strong>Upload Time:</strong> {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}</li>
                </ul>
                
                <h3>Action Required:</h3>
                <p>Please review the uploaded receipt and update the payment status accordingly.</p>
                
                <p><a href="{context.get('admin_url', '#')}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Review in Admin Panel</a></p>
                
                <hr>
                <p><small>This is an automated notification from the R63 Teens Registration System.</small></p>
            </body>
            </html>
            """
            
            plain_message = f"""
            New Payment Receipt Uploaded
            
            A payment receipt has been uploaded for verification.
            
            Ticket Details:
            - Ticket ID: {ticket.ticket_id}
            - Name: {ticket.full_name}
            - Category: {ticket.get_category_display()}
            - Province: {ticket.province}
            - Parish: {ticket.parish}
            - Upload Time: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}
            
            Action Required:
            Please review the uploaded receipt and update the payment status accordingly.
            
            Admin Panel: {context.get('admin_url', 'N/A')}
            """
            
            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=admin_emails,
                html_message=html_message,
                fail_silently=True,  # Don't fail the upload if email fails
            )
            
            logger.info(f"Receipt upload notification sent to {len(admin_emails)} admins")
            
        except Exception as e:
            logger.error(f"Failed to send receipt upload notification: {e}")
    
    @classmethod
    def get_receipt_info(cls, ticket):
        """
        Get information about uploaded receipt
        
        Args:
            ticket: Ticket instance
            
        Returns:
            dict: Receipt information
        """
        if not ticket.proof_of_payment:
            return {
                'has_receipt': False,
                'file_url': None,
                'file_name': None,
                'file_size': None,
                'upload_date': None
            }
        
        try:
            file_size = ticket.proof_of_payment.size
            file_name = os.path.basename(ticket.proof_of_payment.name)
            file_url = ticket.proof_of_payment.url
            
            # Try to get upload date from file stats
            upload_date = None
            try:
                if hasattr(ticket.proof_of_payment, 'file'):
                    upload_date = timezone.datetime.fromtimestamp(
                        os.path.getmtime(ticket.proof_of_payment.path)
                    )
            except:
                pass
            
            return {
                'has_receipt': True,
                'file_url': file_url,
                'file_name': file_name,
                'file_size': file_size,
                'file_size_mb': round(file_size / 1024 / 1024, 2),
                'upload_date': upload_date
            }
            
        except Exception as e:
            logger.error(f"Error getting receipt info for ticket {ticket.ticket_id}: {e}")
            return {
                'has_receipt': True,
                'file_url': None,
                'file_name': 'Unknown',
                'file_size': None,
                'upload_date': None,
                'error': str(e)
            }
    
    @classmethod
    def delete_receipt(cls, ticket):
        """
        Delete receipt file for a ticket
        
        Args:
            ticket: Ticket instance
            
        Returns:
            bool: Success status
        """
        try:
            if ticket.proof_of_payment:
                # Delete file from storage
                if default_storage.exists(ticket.proof_of_payment.name):
                    default_storage.delete(ticket.proof_of_payment.name)
                
                # Clear field
                ticket.proof_of_payment = None
                ticket.payment_status = ticket.PaymentStatus.UNPAID
                ticket.save()
                
                logger.info(f"Receipt deleted for ticket {ticket.ticket_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error deleting receipt for ticket {ticket.ticket_id}: {e}")
            
        return False