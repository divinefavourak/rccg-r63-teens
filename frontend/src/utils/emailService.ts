// Mock email service - in real app, this would connect to SendGrid, AWS SES, etc.
export const emailService = {
    // Send single email
    async sendEmail(to, subject, message, from = 'noreply@rccgregion63.org') {
      console.log('📧 Mock Email Sent:', { to, subject, from });
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        messageId: `mock-${Date.now()}`,
        recipient: to
      };
    },
  
    // Send bulk emails
    async sendBulkEmails(recipients, subject, message, from = 'noreply@rccgregion63.org') {
      console.log('📧 Mock Bulk Email Sent to:', recipients.length, 'recipients');
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const results = recipients.map(recipient => ({
        success: true,
        messageId: `mock-bulk-${Date.now()}-${recipient.id}`,
        recipient: recipient.email,
        name: recipient.name
      }));
      
      return {
        total: recipients.length,
        successful: results.length,
        failed: 0,
        results
      };
    },
  
    // Email templates
    templates: {
      approval: (name, ticketId, eventDetails) => ({
        subject: `🎉 Registration Approved - ${eventDetails.title}`,
        message: `
  Dear ${name},
  
  We are excited to inform you that your registration for ${eventDetails.title} has been approved!
  
  **Registration Details:**
  - Ticket ID: ${ticketId}
  - Event: ${eventDetails.title}
  - Date: ${eventDetails.date}
  - Location: ${eventDetails.location}
  
  **Next Steps:**
  1. Present this email and your ticket at the registration desk
  2. Arrive 30 minutes before the event starts
  3. Bring valid ID for verification
  
  We look forward to seeing you at the event!
  
  Blessings,
  RCCG Region 63 Junior Church Team
        `.trim()
      }),
  
      rejection: (name, ticketId, eventDetails, reason = '') => ({
        subject: `Registration Update - ${eventDetails.title}`,
        message: `
  Dear ${name},
  
  Thank you for your interest in ${eventDetails.title}. 
  
  After reviewing your registration, we are unable to approve your application at this time.${reason ? `\n\nReason: ${reason}` : ''}
  
  **Registration Details:**
  - Ticket ID: ${ticketId}
  - Event: ${eventDetails.title}
  
  If you believe this is an error, please contact us at ${eventDetails.contact.email}.
  
  Thank you for your understanding.
  
  Blessings,
  RCCG Region 63 Junior Church Team
        `.trim()
      }),
  
      reminder: (name, ticketId, eventDetails) => ({
        subject: `🔔 Reminder: ${eventDetails.title} is Coming Soon!`,
        message: `
  Dear ${name},
  
  This is a friendly reminder about the upcoming ${eventDetails.title}!
  
  **Event Details:**
  - Date: ${eventDetails.date}
  - Time: 9:00 AM
  - Location: ${eventDetails.location}
  - Address: ${eventDetails.address}
  
  **Don't Forget:**
  - Bring your ticket (ID: ${ticketId})
  - Arrive 30 minutes early
  - Wear comfortable clothing
  - Bring your Bible and notebook
  
  We're excited to have you join us for this life-changing experience!
  
  See you there!
  RCCG Region 63 Junior Church Team
        `.trim()
      })
    }
  };