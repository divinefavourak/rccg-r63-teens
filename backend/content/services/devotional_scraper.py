"""
Devotional Scraper Service for Teen Open Heaven.

This module scrapes daily devotionals from openheavens.com.ng and saves them
to the Devotional model in the content app.

URL Format:
https://www.openheavens.com.ng/YYYY/MM/open-heaven-for-teens-DD-monthname-YYYY.html

Example:
https://www.openheavens.com.ng/2025/11/open-heaven-for-teens-14-november-2025.html
"""
import logging
import re
from datetime import date, datetime
from typing import Optional, Dict, Any

import requests
from bs4 import BeautifulSoup
from django.utils.text import slugify

logger = logging.getLogger(__name__)


class DevotionalScraper:
    """
    Scraper for Teen Open Heaven devotionals from openheavens.com.ng.
    
    Attributes:
        base_url: The base URL template for devotional pages.
        timeout: Request timeout in seconds.
    """
    
    BASE_URL_TEMPLATE = (
        "https://www.openheavens.com.ng/{year}/{month:02d}/"
        "open-heaven-for-teens-{day}-{month_name}-{year}.html"
    )
    
    # Alternative URL formats to try
    ALT_URL_TEMPLATES = [
        "https://www.openheavens.com.ng/{year}/{month:02d}/open-heaven-for-teens-{day:02d}-{month_name}-{year}.html",
        "https://www.openheavens.com.ng/{year}/{month:02d}/teen-open-heaven-{day}-{month_name}-{year}.html",
        "https://www.openheavens.com.ng/{year}/{month:02d}/open-heaven-for-teens-{day}-{month_name_short}-{year}.html",
    ]
    
    MONTH_NAMES = {
        1: 'january', 2: 'february', 3: 'march', 4: 'april',
        5: 'may', 6: 'june', 7: 'july', 8: 'august',
        9: 'september', 10: 'october', 11: 'november', 12: 'december'
    }
    
    MONTH_NAMES_SHORT = {
        1: 'jan', 2: 'feb', 3: 'mar', 4: 'apr',
        5: 'may', 6: 'jun', 7: 'jul', 8: 'aug',
        9: 'sep', 10: 'oct', 11: 'nov', 12: 'dec'
    }
    
    def __init__(self, timeout: int = 30):
        """
        Initialize the scraper.
        
        Args:
            timeout: Request timeout in seconds.
        """
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        })
    
    def build_url(self, target_date: date) -> str:
        """
        Build the URL for a specific date's devotional.
        
        Args:
            target_date: The date to build the URL for.
            
        Returns:
            The URL string for the devotional page.
        """
        return self.BASE_URL_TEMPLATE.format(
            year=target_date.year,
            month=target_date.month,
            day=target_date.day,
            month_name=self.MONTH_NAMES[target_date.month]
        )
    
    def build_alt_urls(self, target_date: date) -> list:
        """Generate alternative URL formats to try."""
        urls = []
        for template in self.ALT_URL_TEMPLATES:
            try:
                url = template.format(
                    year=target_date.year,
                    month=target_date.month,
                    day=target_date.day,
                    month_name=self.MONTH_NAMES[target_date.month],
                    month_name_short=self.MONTH_NAMES_SHORT[target_date.month]
                )
                urls.append(url)
            except KeyError:
                continue
        return urls
    
    def fetch_page(self, url: str) -> Optional[str]:
        """
        Fetch the HTML content of a page.
        
        Args:
            url: The URL to fetch.
            
        Returns:
            The HTML content as a string, or None if fetch failed.
        """
        try:
            response = self.session.get(url, timeout=self.timeout)
            response.raise_for_status()
            return response.text
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                logger.warning(f"Devotional page not found: {url}")
            else:
                logger.error(f"HTTP error fetching {url}: {e}")
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"Request error fetching {url}: {e}")
            return None
    
    def parse_html(self, html: str, target_date: date, source_url: str) -> Optional[Dict[str, Any]]:
        """
        Parse the HTML content and extract devotional data.
        
        Args:
            html: The HTML content to parse.
            target_date: The date of the devotional.
            source_url: The source URL for reference.
            
        Returns:
            A dictionary with extracted fields, or None if parsing failed.
        """
        soup = BeautifulSoup(html, 'html.parser')
        
        try:
            # Find the main content container
            article = soup.find('article') or soup.find('div', class_='entry-content') or soup.find('div', class_='post-content')
            
            if not article:
                # Try finding by common patterns
                article = soup.find('div', class_=re.compile(r'content|post|article', re.I))
            
            if not article:
                logger.warning(f"Could not find article container for {source_url}")
                article = soup  # Fallback to entire page
            
            # Extract title
            title = self._extract_title(soup, article)
            
            # Extract scripture/memorise text
            anchor_scripture, scripture_text = self._extract_scripture(article)
            
            # Extract main content
            content = self._extract_content(article)
            
            # Extract key point
            key_point = self._extract_key_point(article)
            
            # Extract other fields
            bible_text_passage = self._extract_bible_text_passage(article)
            bible_in_one_year = self._extract_bible_reading(article)
            prayer = self._extract_section(article, ['prayer', 'prayer point', 'prayer focus'])
            action_point = self._extract_section(article, ['action point', 'action', 'do this'])
            hymn = self._extract_section(article, ['hymn', 'song'])
            
            # Validate required fields
            if not title or not content:
                logger.warning(f"Missing required fields for {source_url}")
                return None
            
            return {
                'date': target_date,
                'title': self._clean_text(title)[:255],
                'slug': slugify(f"{target_date}-{title}")[:300],
                'anchor_scripture': self._clean_text(anchor_scripture or '')[:255],
                'scripture_text': self._clean_text(scripture_text or ''),
                'content': self._clean_text(content),
                'key_point': self._clean_text(key_point or '')[:500],
                'bible_in_one_year': self._clean_text(bible_in_one_year or ''),
                'prayer': self._clean_text(prayer or ''),
                'action_point': self._clean_text(action_point or ''),
                'hymn': self._clean_text(hymn or '')[:255],
                'author': 'Pastor E.A. Adeboye',
                'source_url': source_url,
                'status': 'published',
                
                # New Fields Mapping
                'memory_verse_passage': self._clean_text(anchor_scripture or '')[:255],
                'memory_verse_content': self._clean_text(scripture_text or ''),
                'bible_text_passage': self._clean_text(bible_text_passage or '')[:255],
                # bible_text_content is not typically on the page, so leave blank or use external API later
            }
            
        except Exception as e:
            logger.error(f"Error parsing HTML for {source_url}: {e}")
            return None
    
    def _extract_title(self, soup: BeautifulSoup, article) -> str:
        """Extract the devotional title."""
        # Try h1 first
        h1 = soup.find('h1')
        if h1:
            return h1.get_text(strip=True)
        
        # Try entry-title class
        title_elem = soup.find(class_='entry-title') or soup.find(class_='post-title')
        if title_elem:
            return title_elem.get_text(strip=True)
        
        # Try first h2 in article
        h2 = article.find('h2')
        if h2:
            return h2.get_text(strip=True)
        
        return ''
    
    def _extract_scripture(self, article) -> tuple:
        """Extract scripture reference and text."""
        scripture_ref = ''
        scripture_text = ''
        
        # Look for MEMORISE or BIBLE READING patterns
        text_content = article.get_text()
        
        # Pattern for MEMORISE: "verse text" - Reference
        memorise_patterns = [
            r'MEMORISE[:\s]*["\']?(.+?)["\']?\s*[-–—]\s*([A-Za-z0-9\s:]+)',
            r'MEMORY\s+VERSE[:\s]*["\']?(.+?)["\']?\s*[-–—]\s*([A-Za-z0-9\s:]+)',
            r'KEY\s+SCRIPTURE[:\s]*(.+?)\s*[-–—]\s*([A-Za-z0-9\s:]+)',
        ]
        
        for pattern in memorise_patterns:
            match = re.search(pattern, text_content, re.IGNORECASE | re.DOTALL)
            if match:
                scripture_text = match.group(1).strip()
                scripture_ref = match.group(2).strip()
                break
        
        # Alternative: look for strong tags with scripture
        if not scripture_ref:
            strong_tags = article.find_all('strong')
            for tag in strong_tags:
                text = tag.get_text(strip=True)
                if 'memorise' in text.lower() or 'memory verse' in text.lower():
                    # Get next sibling or parent's text
                    next_text = tag.next_sibling
                    if next_text:
                        scripture_text = str(next_text).strip()[:500]
                    break
        
        return scripture_ref, scripture_text
    
    def _extract_content(self, article) -> str:
        """Extract the main devotional content."""
        # Get all paragraph text
        paragraphs = article.find_all('p')
        
        content_parts = []
        skip_patterns = ['memorise', 'bible reading', 'key point', 'prayer', 'hymn', 'action point']
        
        for p in paragraphs:
            text = p.get_text(strip=True)
            if text and not any(pattern in text.lower()[:50] for pattern in skip_patterns):
                content_parts.append(text)
        
        return '\n\n'.join(content_parts)
    
    def _extract_key_point(self, article) -> str:
        """Extract the key point."""
        text_content = article.get_text()
        
        patterns = [
            r'KEY\s+POINT[:\s]*(.+?)(?=PRAYER|HYMN|ACTION|$)',
            r'POINT\s+TO\s+NOTE[:\s]*(.+?)(?=PRAYER|HYMN|ACTION|$)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text_content, re.IGNORECASE | re.DOTALL)
            if match:
                return match.group(1).strip()[:500]
        
        return ''
    
    def _extract_bible_reading(self, article) -> str:
        """Extract Bible in One Year reading."""
        text_content = article.get_text()
        
        patterns = [
            r'BIBLE\s+IN\s+(?:ONE\s+)?YEAR[:\s]*(.+?)(?=MEMORISE|KEY|PRAYER|$)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text_content, re.IGNORECASE | re.DOTALL)
            if match:
                return match.group(1).strip()[:500]
        
        return ''

    def _extract_bible_text_passage(self, article) -> str:
        """Extract the main bible reading reference (e.g. READ: Psalm 23:1-6)."""
        text_content = article.get_text()
        
        patterns = [
            r'READ[:\s]*(.+?)(?=MEMORISE|KEY|PRAYER|BIBLE|MESSAGE|$)',
            r'BIBLE\s+READING[:\s]*(.+?)(?=MEMORISE|KEY|PRAYER|BIBLE|MESSAGE|$)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text_content, re.IGNORECASE | re.DOTALL)
            if match:
                # If the match looks like "Bible in one year", ignore it (validation overlap)
                extracted = match.group(1).strip()
                if "year" in extracted.lower():
                    continue
                return extracted[:255]
        
        return ''
    
    def _extract_section(self, article, keywords: list) -> str:
        """Extract a section by keyword."""
        text_content = article.get_text()
        
        for keyword in keywords:
            pattern = rf'{keyword}[:\s]*(.+?)(?=\n\n|\Z)'
            match = re.search(pattern, text_content, re.IGNORECASE | re.DOTALL)
            if match:
                return match.group(1).strip()[:1000]
        
        return ''
    
    def _clean_text(self, text: str) -> str:
        """Clean extracted text by removing extra whitespace and HTML artifacts."""
        if not text:
            return ''
        
        # Remove multiple whitespaces
        text = re.sub(r'\s+', ' ', text)
        
        # Remove leading/trailing whitespace
        text = text.strip()
        
        # Remove common HTML artifacts
        text = re.sub(r'&nbsp;', ' ', text)
        text = re.sub(r'&amp;', '&', text)
        text = re.sub(r'&lt;', '<', text)
        text = re.sub(r'&gt;', '>', text)
        
        return text
    
    def scrape(self, target_date: date) -> Optional[Dict[str, Any]]:
        """
        Scrape devotional for a specific date.
        
        Args:
            target_date: The date to scrape the devotional for.
            
        Returns:
            A dictionary with devotional data, or None if not found.
        """
        # Try primary URL first
        url = self.build_url(target_date)
        logger.info(f"Scraping devotional for {target_date} from {url}")
        
        html = self.fetch_page(url)
        
        # If primary fails, try alternative URLs
        if not html:
            alt_urls = self.build_alt_urls(target_date)
            for alt_url in alt_urls:
                logger.info(f"Trying alternative URL: {alt_url}")
                html = self.fetch_page(alt_url)
                if html:
                    url = alt_url
                    break
        
        if not html:
            logger.warning(f"Could not fetch devotional for {target_date}")
            return None
        
        return self.parse_html(html, target_date, url)


def scrape_and_save_devotional(target_date: date = None) -> Optional[dict]:
    """
    Scrape a devotional and save it to the database.
    
    Args:
        target_date: The date to scrape. Defaults to today.
        
    Returns:
        The saved devotional data as a dict, or None if failed.
    """
    from content.models import Devotional
    
    if target_date is None:
        target_date = date.today()
    
    # Check if already exists
    if Devotional.objects.filter(date=target_date).exists():
        logger.info(f"Devotional for {target_date} already exists, skipping.")
        return None
    
    # Scrape
    scraper = DevotionalScraper()
    data = scraper.scrape(target_date)
    
    if not data:
        logger.warning(f"Failed to scrape devotional for {target_date}")
        return None
    
    # Remove source_url from data as it's not a model field
    source_url = data.pop('source_url', '')
    
    try:
        # Create devotional
        devotional = Devotional.objects.create(**data)
        logger.info(f"Successfully saved devotional for {target_date}: {devotional.title}")
        
        return {
            'id': str(devotional.id),
            'date': str(devotional.date),
            'title': devotional.title,
            'source_url': source_url,
        }
    except Exception as e:
        logger.error(f"Error saving devotional for {target_date}: {e}")
        return None
