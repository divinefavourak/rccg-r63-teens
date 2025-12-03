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
    
#  EMAIL SERVICE
    
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags


class EmailService:
    """Service for sending emails"""
    
    @staticmethod
    def send_ticket_confirmation(ticket):
        """Send ticket confirmation email"""
        subject = f"RCCG R63 Teens - Ticket Confirmation: {ticket.ticket_id}"
        
        context = {
            'ticket': ticket,
            'full_name': ticket.full_name,
            'ticket_id': ticket.ticket_id,
            'category': ticket.get_category_display(),
            'registered_at': ticket.registered_at,
        }
        
        html_message = render_to_string('emails/ticket_confirmation.html', context)
        plain_message = strip_tags(html_message)
        
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[ticket.email, ticket.parent_email],
            html_message=html_message,
            fail_silently=False,
        )
    
    @staticmethod
    def send_payment_confirmation(payment):
        """Send payment confirmation email"""
        subject = f"RCCG R63 Teens - Payment Confirmation: {payment.reference}"
        
        context = {
            'payment': payment,
            'amount': payment.formatted_amount,
            'reference': payment.reference,
            'ticket': payment.ticket,
        }
        
        html_message = render_to_string('emails/payment_confirmation.html', context)
        plain_message = strip_tags(html_message)
        
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[payment.payer_email],
            html_message=html_message,
            fail_silently=False,
        )
    
    @staticmethod
    def send_status_update(ticket, old_status, new_status):
        """Send ticket status update email"""
        subject = f"RCCG R63 Teens - Ticket Status Update: {ticket.ticket_id}"
        
        context = {
            'ticket': ticket,
            'old_status': old_status,
            'new_status': new_status,
            'full_name': ticket.full_name,
            'ticket_id': ticket.ticket_id,
        }
        
        html_message = render_to_string('emails/status_update.html', context)
        plain_message = strip_tags(html_message)
        
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[ticket.email, ticket.parent_email],
            html_message=html_message,
            fail_silently=False,
        )
        
# PDF SERVICE
        
from io import BytesIO
from django.http import HttpResponse
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from .services import QRCodeService


class PDFService:
    """Service for generating PDFs"""
    
    @staticmethod
    def generate_ticket_pdf(ticket):
        """Generate PDF ticket"""
        buffer = BytesIO()
        
        # Create PDF document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72
        )
        
        # Create styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=1  # Center
        )
        
        # Create story (content)
        story = []
        
        # Title
        story.append(Paragraph("RCCG R63 Teens Event", title_style))
        story.append(Paragraph("OFFICIAL TICKET", styles['Heading2']))
        story.append(Spacer(1, 20))
        
        # Ticket Info Table
        ticket_data = [
            ['Ticket ID:', ticket.ticket_id],
            ['Full Name:', ticket.full_name],
            ['Age:', str(ticket.age)],
            ['Category:', ticket.get_category_display()],
            ['Gender:', ticket.get_gender_display()],
            ['Status:', ticket.get_status_display()],
            ['Registered:', ticket.registered_at.strftime('%Y-%m-%d %H:%M')],
        ]
        
        if ticket.approved_at:
            ticket_data.append(['Approved:', ticket.approved_at.strftime('%Y-%m-%d %H:%M')])
        
        ticket_table = Table(ticket_data, colWidths=[2*inch, 3*inch])
        ticket_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        
        story.append(ticket_table)
        story.append(Spacer(1, 30))
        
        # Add QR Code if exists
        if ticket.qr_code:
            # Get QR code as base64
            qr_base64 = QRCodeService.get_qr_code_base64(ticket)
            
            # Decode and create image
            import base64
            qr_data = base64.b64decode(qr_base64)
            qr_image = Image(BytesIO(qr_data), width=2*inch, height=2*inch)
            qr_image.hAlign = 'CENTER'
            story.append(qr_image)
        
        # Terms and Conditions
        story.append(Spacer(1, 30))
        story.append(Paragraph("Terms & Conditions:", styles['Heading3']))
        terms = [
            "1. This ticket is non-transferable.",
            "2. Present this ticket at the entrance.",
            "3. Keep this ticket safe until the event is over.",
            "4. Lost tickets cannot be replaced.",
            "5. The organizers reserve the right to refuse entry.",
        ]
        
        for term in terms:
            story.append(Paragraph(term, styles['Normal']))
            story.append(Spacer(1, 5))
        
        # Build PDF
        doc.build(story)
        
        # Get PDF value
        pdf = buffer.getvalue()
        buffer.close()
        
        return pdf
    
    @staticmethod
    def generate_bulk_tickets_pdf(tickets):
        """Generate PDF with multiple tickets"""
        buffer = BytesIO()
        
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72
        )
        
        story = []
        styles = getSampleStyleSheet()
        
        # Title
        story.append(Paragraph("RCCG R63 Teens - Ticket Report", styles['Heading1']))
        story.append(Spacer(1, 20))
        
        # Create table data
        table_data = [['Ticket ID', 'Name', 'Age', 'Category', 'Status', 'Registered By']]
        
        for ticket in tickets:
            table_data.append([
                ticket.ticket_id,
                ticket.full_name,
                str(ticket.age),
                ticket.get_category_display(),
                ticket.get_status_display(),
                ticket.registered_by.get_display_name() if ticket.registered_by else ''
            ])
        
        # Create table
        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        
        story.append(table)
        
        # Build PDF
        doc.build(story)
        
        pdf = buffer.getvalue()
        buffer.close()
        
        return pdf