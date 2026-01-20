"""
Celery tasks for the content app.
"""
import logging
from datetime import date
from celery import shared_task

logger = logging.getLogger(__name__)


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
