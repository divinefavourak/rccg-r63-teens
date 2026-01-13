"""
Custom Email Backend for Brevo with SSL certificate verification disabled.
This is needed because Python on Windows sometimes has SSL certificate issues.
"""
import ssl
from django.core.mail.backends.smtp import EmailBackend


class BrevoEmailBackend(EmailBackend):
    """
    Custom SMTP backend that disables SSL certificate verification.
    This is a workaround for Windows SSL certificate issues with Brevo.
    """
    
    def open(self):
        """
        Override to use a custom SSL context that doesn't verify certificates.
        """
        if self.connection:
            return False
        
        try:
            # Create SSL context without certificate verification
            self.ssl_context = ssl.create_default_context()
            self.ssl_context.check_hostname = False
            self.ssl_context.verify_mode = ssl.CERT_NONE
            
            # Use the parent's open method but with our SSL context
            import smtplib
            
            if self.use_ssl:
                self.connection = smtplib.SMTP_SSL(
                    self.host, 
                    self.port, 
                    timeout=self.timeout,
                    context=self.ssl_context
                )
            else:
                self.connection = smtplib.SMTP(
                    self.host, 
                    self.port, 
                    timeout=self.timeout
                )
                if self.use_tls:
                    self.connection.starttls(context=self.ssl_context)
            
            if self.username and self.password:
                self.connection.login(self.username, self.password)
            
            return True
            
        except Exception:
            if not self.fail_silently:
                raise
            return False
