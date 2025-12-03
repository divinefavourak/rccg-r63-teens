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
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
import base64


class PDFService:
    """Service for generating PDFs"""
    
    @staticmethod
    def generate_ticket_pdf(ticket):
        """Generate PDF ticket"""
        buffer = BytesIO()
        
        # Create PDF document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=1*cm,
            leftMargin=1*cm,
            topMargin=1*cm,
            bottomMargin=1*cm
        )
        
        # Create styles
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=20,
            spaceAfter=20,
            alignment=1,  # Center
            textColor=colors.HexColor('#2E7D32')  # Green
        )
        
        subtitle_style = ParagraphStyle(
            'CustomSubtitle',
            parent=styles['Heading2'],
            fontSize=16,
            spaceAfter=15,
            alignment=1,
            textColor=colors.HexColor('#1B5E20')
        )
        
        # Create story (content)
        story = []
        
        # Header
        story.append(Paragraph("THE REDEEMED CHRISTIAN CHURCH OF GOD", title_style))
        story.append(Paragraph("REGION 63 - TEENS EVENT", subtitle_style))
        story.append(Paragraph("OFFICIAL ENTRY TICKET", styles['Heading3']))
        story.append(Spacer(1, 30))
        
        # Generate QR code
        from .services import QRCodeService
        qr_base64 = QRCodeService.get_qr_code_base64(ticket)
        qr_image_data = base64.b64decode(qr_base64)
        
        # Add QR code image
        qr_image = Image(BytesIO(qr_image_data), width=3*cm, height=3*cm)
        qr_image.hAlign = 'CENTER'
        story.append(qr_image)
        story.append(Spacer(1, 10))
        
        # Verification code
        story.append(Paragraph(
            f"<b>Verification Code:</b> RCCG-{ticket.ticket_id}",
            ParagraphStyle('CodeStyle', parent=styles['Normal'], alignment=1, fontSize=12)
        ))
        story.append(Spacer(1, 20))
        
        # Ticket Info Table
        ticket_data = [
            ['<b>Ticket ID:</b>', ticket.ticket_id],
            ['<b>Full Name:</b>', ticket.full_name],
            ['<b>Age:</b>', str(ticket.age)],
            ['<b>Category:</b>', ticket.get_category_display()],
            ['<b>Gender:</b>', ticket.get_gender_display()],
            ['<b>Status:</b>', f'<font color="green">{ticket.get_status_display()}</font>' if ticket.status == 'approved' else ticket.get_status_display()],
            ['<b>Registered:</b>', ticket.registered_at.strftime('%Y-%m-%d %H:%M')],
        ]
        
        if ticket.approved_at:
            ticket_data.append(['<b>Approved:</b>', ticket.approved_at.strftime('%Y-%m-%d %H:%M')])
        
        ticket_table = Table(ticket_data, colWidths=[2.5*cm, 12*cm])
        ticket_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
            ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ]))
        
        story.append(ticket_table)
        story.append(Spacer(1, 30))
        
        # Church Information
        church_data = [
            ['<b>Province:</b>', ticket.province],
            ['<b>Zone:</b>', ticket.zone],
            ['<b>Area:</b>', ticket.area],
            ['<b>Parish:</b>', ticket.parish],
        ]
        
        if ticket.department:
            church_data.append(['<b>Department:</b>', ticket.department])
        
        church_table = Table(church_data, colWidths=[2.5*cm, 12*cm])
        church_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
            ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ]))
        
        story.append(Paragraph("<b>Church Information:</b>", styles['Heading4']))
        story.append(church_table)
        story.append(Spacer(1, 20))
        
        # Emergency Contact
        emergency_data = [
            ['<b>Emergency Contact:</b>', ticket.emergency_contact],
            ['<b>Emergency Phone:</b>', ticket.emergency_phone],
            ['<b>Relationship:</b>', ticket.emergency_relationship],
            ['<b>Parent/Guardian:</b>', ticket.parent_name],
            ['<b>Parent Phone:</b>', ticket.parent_phone],
        ]
        
        emergency_table = Table(emergency_data, colWidths=[4*cm, 10.5*cm])
        emergency_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
            ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ]))
        
        story.append(Paragraph("<b>Emergency & Parent Information:</b>", styles['Heading4']))
        story.append(emergency_table)
        story.append(Spacer(1, 30))
        
        # Terms and Conditions
        story.append(Paragraph("<b>Terms & Conditions:</b>", styles['Heading4']))
        
        terms = [
            "1. This ticket is non-transferable and valid for the RCCG Region 63 Teens Event only.",
            "2. Present this ticket or QR code at the entrance for verification.",
            "3. Keep this ticket safe; lost tickets cannot be replaced.",
            "4. All attendees must comply with event rules and regulations.",
            "5. The organizers reserve the right to refuse entry.",
            "6. This ticket may be revoked for misconduct.",
        ]
        
        for term in terms:
            story.append(Paragraph(f"• {term}", styles['Normal']))
            story.append(Spacer(1, 3))
        
        story.append(Spacer(1, 20))
        
        # Footer
        footer_style = ParagraphStyle(
            'FooterStyle',
            parent=styles['Normal'],
            fontSize=8,
            alignment=1,
            textColor=colors.grey
        )
        
        story.append(Paragraph("For verification issues, contact your province coordinator.", footer_style))
        story.append(Paragraph(f"Generated on: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}", footer_style))
        
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
            pagesize=A4,
            rightMargin=1*cm,
            leftMargin=1*cm,
            topMargin=1*cm,
            bottomMargin=1*cm
        )
        
        story = []
        styles = getSampleStyleSheet()
        
        # Title
        title_style = ParagraphStyle(
            'ReportTitle',
            parent=styles['Heading1'],
            fontSize=18,
            spaceAfter=20,
            alignment=1,
            textColor=colors.HexColor('#2E7D32')
        )
        
        story.append(Paragraph("RCCG REGION 63 - TEENS EVENT TICKET REPORT", title_style))
        story.append(Paragraph(f"Generated: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))
        story.append(Paragraph(f"Total Tickets: {tickets.count()}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Create table data
        table_data = [['Ticket ID', 'Name', 'Age', 'Category', 'Status', 'Province', 'Registered']]
        
        for ticket in tickets:
            table_data.append([
                ticket.ticket_id,
                ticket.full_name,
                str(ticket.age),
                ticket.get_category_display(),
                ticket.get_status_display(),
                ticket.province,
                ticket.registered_at.strftime('%Y-%m-%d') if ticket.registered_at else ''
            ])
        
        # Create table
        table = Table(table_data, repeatRows=1)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4CAF50')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
        ]))
        
        story.append(table)
        
        # Add summary
        story.append(Spacer(1, 30))
        
        # Status summary
        status_counts = tickets.values('status').annotate(count=Count('id'))
        if status_counts:
            story.append(Paragraph("<b>Status Summary:</b>", styles['Heading4']))
            status_data = [['Status', 'Count', 'Percentage']]
            
            total = tickets.count()
            for item in status_counts:
                percentage = (item['count'] / total * 100) if total > 0 else 0
                status_data.append([
                    item['status'].title(),
                    str(item['count']),
                    f"{percentage:.1f}%"
                ])
            
            status_table = Table(status_data, colWidths=[4*cm, 3*cm, 3*cm])
            status_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ]))
            
            story.append(status_table)
        
        # Build PDF
        doc.build(story)
        
        pdf = buffer.getvalue()
        buffer.close()
        
        return pdf