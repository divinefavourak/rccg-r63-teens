import qrcode
from io import BytesIO
from django.core.files.base import ContentFile
from django.utils import timezone
import base64


class QRCodeService:
    """Service for generating QR codes"""
    
    @staticmethod
    def generate_ticket_qr_code(ticket):
        """Generate QR code for a ticket"""
        # Create QR code data
        qr_data = {
            'ticket_id': ticket.ticket_id,
            'full_name': ticket.full_name,
            'category': ticket.category,
            'status': ticket.status,
            'verification_url': f"/verify/{ticket.id}",
            'timestamp': timezone.now().isoformat()
        }
        
        # Convert to string
        qr_string = f"RCCG_TICKET:{ticket.ticket_id}:{ticket.full_name}:{ticket.status}"
        
        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(qr_string)
        qr.make(fit=True)
        
        # Create image
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Save to BytesIO
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        
        # Save to ticket
        filename = f"qr_{ticket.ticket_id}.png"
        ticket.qr_code.save(filename, ContentFile(buffer.getvalue()), save=False)
        ticket.save()
        
        return ticket.qr_code
    
    @staticmethod
    def get_qr_code_base64(ticket):
        """Get QR code as base64 string"""
        if not ticket.qr_code:
            QRCodeService.generate_ticket_qr_code(ticket)
        
        with ticket.qr_code.open('rb') as f:
            qr_data = f.read()
        
        return base64.b64encode(qr_data).decode('utf-8')