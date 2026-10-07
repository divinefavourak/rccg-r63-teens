"""
Custom Email Backend for Brevo with SSL certificate verification disabled.
This is needed because Python on Windows sometimes has SSL certificate issues.
"""
import base64
import logging
import ssl
from email.utils import parseaddr

import requests
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail.backends.smtp import EmailBackend

logger = logging.getLogger(__name__)


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


class BrevoApiEmailBackend(BaseEmailBackend):
    """
    Sends through Brevo's HTTPS API instead of SMTP.

    Some hosts block outbound SMTP ports (Render does on its free web
    services), and then every send fails at the connection, before Brevo is
    ever reached. HTTPS on port 443 is never blocked. Selected in settings when
    `BREVO_API_KEY` is set; that is a Brevo *API* key, not the SMTP key.
    """

    URL = 'https://api.brevo.com/v3/smtp/email'
    timeout = 20

    def send_messages(self, email_messages):
        sent = 0
        for message in email_messages or []:
            try:
                self._send(message)
                sent += 1
            except Exception:
                logger.exception(
                    'Brevo refused or could not be reached for %s', message.to)
                if not self.fail_silently:
                    raise
        return sent

    @staticmethod
    def _address(value):
        name, email = parseaddr(value)
        return {'name': name, 'email': email} if name else {'email': email}

    def _send(self, message):
        html = next(
            (content for content, mimetype in getattr(message, 'alternatives', [])
             if mimetype == 'text/html'),
            None,
        )
        payload = {
            'sender': self._address(message.from_email),
            'to': [self._address(to) for to in message.to],
            'subject': message.subject,
        }
        if html:
            payload['htmlContent'] = html
        if message.body:
            payload['textContent'] = message.body
        if not html and not message.body:
            payload['textContent'] = ' '
        if message.cc:
            payload['cc'] = [self._address(cc) for cc in message.cc]
        if message.bcc:
            payload['bcc'] = [self._address(bcc) for bcc in message.bcc]
        if message.reply_to:
            payload['replyTo'] = self._address(message.reply_to[0])

        attachments = []
        for attachment in message.attachments:
            # Django keeps these as (filename, content, mimetype) tuples.
            if not isinstance(attachment, tuple):
                continue
            filename, content, _ = attachment
            if isinstance(content, str):
                content = content.encode('utf-8')
            attachments.append({
                'name': filename,
                'content': base64.b64encode(content).decode('ascii'),
            })
        if attachments:
            payload['attachment'] = attachments

        response = requests.post(
            self.URL,
            json=payload,
            headers={'api-key': settings.BREVO_API_KEY, 'accept': 'application/json'},
            timeout=self.timeout,
        )
        if response.status_code >= 300:
            # Brevo says why in the body: an unverified sender, a bad key.
            raise RuntimeError(f'Brevo answered {response.status_code}: {response.text[:300]}')
