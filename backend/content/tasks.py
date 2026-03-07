"""
Celery tasks for the content app.
"""
import logging
import threading
from datetime import date
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name='content.tasks.send_daily_devotional_email')
def send_daily_devotional_email(devotional_id):
    """
    Send today's devotional to all users who have email_notifications enabled.

    Args:
        devotional_id: UUID of the Devotional to send.
    """
    from django.conf import settings
    from django.core.mail import EmailMultiAlternatives
    from django.template.loader import render_to_string
    from django.utils.html import strip_tags

    from content.models import Devotional
    from users.models import User
    from utils.email_senders import get_sender

    try:
        devotional = Devotional.objects.get(pk=devotional_id)
    except Devotional.DoesNotExist:
        logger.error('Devotional %s not found — cannot send email.', devotional_id)
        return {'success': False, 'reason': 'devotional_not_found'}

    recipients = list(
        User.objects.filter(email_notifications=True, is_active=True)
        .values_list('email', flat=True)
    )

    if not recipients:
        logger.info('No subscribed recipients for devotional email.')
        return {'success': True, 'sent': 0}

    frontend_url = getattr(settings, 'FRONTEND_URL', None) or 'https://rccg-r63-juniorchurch.vercel.app'
    devotional_url = f"{frontend_url}/devotional/{devotional.slug}"

    context = {
        'devotional': devotional,
        'devotional_url': devotional_url,
        'frontend_url': frontend_url,
        'logo_url': 'https://pub-b5941d04504949d5a4bd4ee53aea9a2d.r2.dev/logo.jpg',
        'faith_logo_url': 'https://pub-b5941d04504949d5a4bd4ee53aea9a2d.r2.dev/faith_logo.jpg',
    }

    html = render_to_string('emails/daily_devotional.html', context)
    plain = strip_tags(html)
    from_email = get_sender('junior_church')
    subject = f"Today's Devotional – {devotional.title} ({devotional.date.strftime('%B %d, %Y')})"

    # Send in batches of 50 to avoid SMTP timeouts
    batch_size = 50
    sent = 0
    failed = 0

    for i in range(0, len(recipients), batch_size):
        batch = recipients[i:i + batch_size]
        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=plain,
                from_email=from_email,
                bcc=batch,  # BCC so recipients don't see each other's emails
            )
            msg.attach_alternative(html, 'text/html')
            msg.send(fail_silently=False)
            sent += len(batch)
        except Exception as exc:
            logger.error('Failed to send devotional batch %d: %s', i // batch_size, exc)
            failed += len(batch)

    logger.info(
        'Devotional email "%s" sent: %d delivered, %d failed.',
        devotional.title, sent, failed
    )
    return {'success': True, 'sent': sent, 'failed': failed}


@shared_task(
    name='content.tasks.daily_devotional_scrape',
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={'max_retries': 3},
)
def daily_devotional_scrape(self):
    """
    Celery task to scrape and save today's Teen Open Heaven devotional.
    
    This task is scheduled to run daily at 00:10 server time.
    It will:
    - Check if today's devotional already exists
    - If not, scrape from openheavens.com.ng
    - Save to the Devotional model
    
    Returns:
        dict: Result information including success status.
    """
    from content.services.devotional_scraper import scrape_and_save_devotional
    from content.models import Devotional
    
    today = date.today()
    
    logger.info(f"Starting daily devotional scrape for {today}")
    
    # Check if already exists
    if Devotional.objects.filter(date=today).exists():
        logger.info(f"Devotional for {today} already exists, skipping.")
        return {
            'success': True,
            'action': 'skipped',
            'date': str(today),
            'reason': 'already_exists',
        }
    
    # Attempt to scrape
    result = scrape_and_save_devotional(today)
    
    if result:
        logger.info(f"Successfully scraped devotional for {today}: {result['title']}")

        # Trigger subscriber email — runs as a separate Celery task so a
        # slow SMTP delivery never blocks the scrape result being recorded.
        try:
            devotional = Devotional.objects.get(date=today)
            send_daily_devotional_email.delay(str(devotional.pk))
        except Devotional.DoesNotExist:
            logger.warning('Devotional for %s not found after scrape — skipping email.', today)

        return {
            'success': True,
            'action': 'created',
            'date': str(today),
            'title': result['title'],
        }
    else:
        logger.warning(f"Failed to scrape devotional for {today}")
        return {
            'success': False,
            'action': 'failed',
            'date': str(today),
            'reason': 'scrape_failed',
        }


@shared_task(name='content.tasks.scrape_devotional_for_date')
def scrape_devotional_for_date(date_str: str):
    """
    Scrape devotional for a specific date.
    
    Args:
        date_str: Date in YYYY-MM-DD format.
        
    Returns:
        dict: Result information.
    """
    from content.services.devotional_scraper import scrape_and_save_devotional
    
    target_date = date.fromisoformat(date_str)
    
    logger.info(f"Scraping devotional for {target_date}")
    
    result = scrape_and_save_devotional(target_date)
    
    if result:
        return {
            'success': True,
            'date': date_str,
            'title': result['title'],
        }
    else:
        return {
            'success': False,
            'date': date_str,
            'reason': 'scrape_failed',
        }


@shared_task(name='content.tasks.backfill_devotionals')
def backfill_devotionals(days: int = 30):
    """
    Backfill missing devotionals for the past N days.
    
    Args:
        days: Number of days to backfill.
        
    Returns:
        dict: Summary of backfill operation.
    """
    from datetime import timedelta
    from content.services.devotional_scraper import scrape_and_save_devotional
    from content.models import Devotional
    
    today = date.today()
    scraped = 0
    skipped = 0
    failed = 0
    
    for i in range(days):
        target_date = today - timedelta(days=i)
        
        if Devotional.objects.filter(date=target_date).exists():
            skipped += 1
            continue
        
        result = scrape_and_save_devotional(target_date)
        
        if result:
            scraped += 1
        else:
            failed += 1
    
    logger.info(f"Backfill complete: scraped={scraped}, skipped={skipped}, failed={failed}")
    
    return {
        'days_requested': days,
        'scraped': scraped,
        'skipped': skipped,
        'failed': failed,
    }
