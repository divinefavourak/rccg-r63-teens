"""
Devotional Scraper Service for Teen Open Heaven.

This module scrapes daily devotionals from openheavens.com.ng and saves them
to the Devotional model in the content app.

URL Format:
https://www.openheavens.com.ng/YYYY/MM/open-heaven-for-teens-DD-monthname-YYYY.html
"""
import logging
import re
from datetime import date
from typing import Optional, Dict, Any, List
from contextlib import contextmanager

import requests
from bs4 import BeautifulSoup, Tag
from django.utils.text import slugify

logger = logging.getLogger(__name__)


class ScraperException(Exception):
    """Base exception for scraper errors."""
    pass


class DevotionalScraper:
    """
    Scraper for Teen Open Heaven devotionals from openheavens.com.ng.
    """
    
    BASE_URL_TEMPLATE = (
        "https://www.openheavens.com.ng/{year}/{month:02d}/"
        "open-heaven-for-teens-{day}-{month_name}-{year}.html"
    )
    
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
    
    # Required fields that must have content
    REQUIRED_FIELDS = ['title', 'content']
    
    def __init__(self, timeout: int = 30):
        self.timeout = timeout
        self._session = None
    
    @contextmanager
    def _get_session(self):
        """Context manager for requests session."""
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        })
        try:
            yield session
        finally:
            session.close()
    
    def build_url(self, target_date: date) -> str:
        """Build the primary URL for a given date."""
        return self.BASE_URL_TEMPLATE.format(
            year=target_date.year,
            month=target_date.month,
            day=target_date.day,
            month_name=self.MONTH_NAMES[target_date.month]
        )
    
    def build_alt_urls(self, target_date: date) -> List[str]:
        """Build alternative URLs to try if primary fails."""
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
        """Fetch a page with proper error handling."""
        try:
            with self._get_session() as session:
                response = session.get(url, timeout=self.timeout)
                if response.status_code == 404:
                    logger.warning(f"Devotional page not found: {url}")
                    return None
                response.raise_for_status()
                return response.text
        except requests.exceptions.Timeout:
            logger.error(f"Timeout fetching {url}")
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching {url}: {e}")
            return None
    
    def _clean_text(self, text: str, preserve_newlines: bool = False) -> str:
        """Clean extracted text by removing extra whitespace and HTML entities."""
        if not text:
            return ''
        
        # Decode HTML entities
        text = text.replace('&nbsp;', ' ')
        text = text.replace('&amp;', '&')
        text = text.replace('&lt;', '<')
        text = text.replace('&gt;', '>')
        text = text.replace('&quot;', '"')
        text = text.replace('&#039;', "'")
        
        if preserve_newlines:
            # Clean up spaces on each line but keep line breaks
            lines = [re.sub(r'[ \t]+', ' ', line).strip() for line in text.split('\n')]
            return '\n'.join(line for line in lines if line)
        else:
            # Replace all whitespace with single space
            return re.sub(r'\s+', ' ', text).strip()
    
    def _find_section_content(self, soup: BeautifulSoup, label: str, 
                              next_labels: List[str] = None) -> Optional[str]:
        """
        Find content for a section by looking for the label and extracting 
        content until the next section label.
        """
        if next_labels is None:
            next_labels = ['MESSAGE', 'KEY POINT', 'PRAYER', 'HYMN', 'BIBLE IN ONE YEAR', 'AUTHOR']
        
        # Find all text elements
        all_elements = soup.find_all(['p', 'div', 'strong', 'b', 'h1', 'h2', 'h3', 'h4'])
        
        content_parts = []
        capturing = False
        
        for elem in all_elements:
            elem_text = elem.get_text().strip()
            
            # Check if this is our target label
            if label.upper() in elem_text.upper() and not capturing:
                capturing = True
                # Extract content after the label on the same line
                content_after_label = re.sub(
                    rf'^.*?{re.escape(label)}:?\s*', 
                    '', 
                    elem_text, 
                    flags=re.IGNORECASE
                ).strip()
                if content_after_label:
                    content_parts.append(content_after_label)
                continue
            
            # Check if we've hit a next section
            if capturing and any(next_label.upper() in elem_text.upper() for next_label in next_labels):
                break
            
            # Capture content
            if capturing and elem_text:
                content_parts.append(elem_text)
        
        return ' '.join(content_parts) if content_parts else None
    
    def _extract_theme(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract the theme/title of the devotional."""
        # Look for THEME: label
        for elem in soup.find_all(['p', 'strong', 'b', 'h1', 'h2', 'h3']):
            text = elem.get_text().strip()
            if re.match(r'^\s*THEME:', text, re.IGNORECASE):
                theme = re.sub(r'^\s*THEME:\s*', '', text, flags=re.IGNORECASE)
                return self._clean_text(theme)
        
        # Fallback to H1 or first strong/bold text
        h1 = soup.find('h1')
        if h1:
            return self._clean_text(h1.get_text())
        
        return None
    
    def _extract_memory_verse(self, soup: BeautifulSoup) -> Dict[str, str]:
        """Extract memory verse content and reference."""
        result = {'content': '', 'passage': ''}
        
        content = self._find_section_content(soup, 'MEMORISE', ['BIBLE READING', 'READ'])
        if not content:
            return result
        
        # Try to split verse text from reference
        # Pattern: "verse text" - Reference  OR  verse text (Reference)
        match = re.search(
            r'^(.+?)\s*[-–—]\s*([1-3]?\s*[A-Za-z]+\s+\d+:\d+[a-z]?(?:-\d+[a-z]?)?)\s*$',
            content
        )
        if match:
            result['content'] = self._clean_text(match.group(1).strip('"\''))
            result['passage'] = self._clean_text(match.group(2))
        else:
            # Try another pattern with parentheses
            match = re.search(
                r'^(.+?)\s*\(([1-3]?\s*[A-Za-z]+\s+\d+:\d+[a-z]?(?:-\d+[a-z]?)?)\)\s*$',
                content
            )
            if match:
                result['content'] = self._clean_text(match.group(1).strip('"\''))
                result['passage'] = self._clean_text(match.group(2))
            else:
                # If we can't split, put everything in content
                result['content'] = self._clean_text(content)
        
        return result
    
    def _extract_bible_reading(self, soup: BeautifulSoup) -> Dict[str, str]:
        """Extract Bible reading passage and content."""
        result = {'passage': '', 'content': ''}
        
        content = self._find_section_content(soup, 'BIBLE READING', ['MESSAGE'])
        if not content:
            # Try alternative label
            content = self._find_section_content(soup, 'READ', ['MESSAGE'])
        
        if not content:
            return result
        
        # Extract the passage reference (e.g., "2 Kings 4:8-17")
        passage_match = re.search(
            r'([1-3]?\s*[A-Za-z]+\s+\d+:\d+(?:-\d+)?)',
            content
        )
        if passage_match:
            result['passage'] = self._clean_text(passage_match.group(1))
            # Remove the passage from content to get the actual text
            bible_text = content.replace(passage_match.group(0), '', 1)
            result['content'] = self._clean_text(bible_text)
        else:
            result['content'] = self._clean_text(content)
        
        return result
    
    def _extract_message(self, soup: BeautifulSoup) -> str:
        """Extract the main message/content."""
        content = self._find_section_content(
            soup, 
            'MESSAGE', 
            ['KEY POINT', 'PRAYER', 'HYMN', 'BIBLE IN ONE YEAR']
        )
        return self._clean_text(content) if content else ''
    
    def _extract_key_point(self, soup: BeautifulSoup) -> str:
        """Extract the key point."""
        content = self._find_section_content(
            soup, 
            'KEY POINT', 
            ['PRAYER', 'BIBLE IN ONE YEAR', 'HYMN', 'AUTHOR']
        )
        return self._clean_text(content) if content else ''
    
    def _extract_bible_in_one_year(self, soup: BeautifulSoup) -> str:
        """Extract Bible in one year reading."""
        content = self._find_section_content(
            soup, 
            'BIBLE IN ONE YEAR', 
            ['HYMN', 'AUTHOR', 'PRAYER']
        )
        return self._clean_text(content) if content else ''
    
    def _extract_hymn(self, soup: BeautifulSoup) -> str:
        """Extract hymn content with preserved formatting."""
        content = self._find_section_content(
            soup, 
            'HYMN', 
            ['BIBLE IN ONE YEAR', 'AUTHOR', 'PRAYER']
        )
        # Preserve newlines for hymn lyrics
        return self._clean_text(content, preserve_newlines=True) if content else ''
    
    def parse_html(self, html: str, target_date: date, source_url: str) -> Optional[Dict[str, Any]]:
        """Parse the HTML content and extract devotional data."""
        soup = BeautifulSoup(html, 'html.parser')
        
        # Find the main content container
        article = (
            soup.find('div', class_='entry-content') or 
            soup.find('article') or 
            soup.find('div', class_='post-content') or
            soup.find('div', class_='content')
        )
        
        if not article:
            logger.warning(f"Could not find article container for {source_url}")
            return None
        
        # Use the article for parsing
        soup = article if isinstance(article, BeautifulSoup) else BeautifulSoup(str(article), 'html.parser')
        
        # Extract all sections
        data = {
            'date': target_date,
            'source_url': source_url,
            'status': 'published',
            'author': 'Pastor E.A. Adeboye',
        }
        
        # Theme/Title
        title = self._extract_theme(soup)
        if not title:
            logger.warning(f"No theme found for {target_date}, using default")
            title = f'Open Heaven for Teens - {target_date.strftime("%B %d, %Y")}'
        data['title'] = title
        data['slug'] = slugify(f"{target_date}-{title}")[:300]
        
        # Memory Verse
        memory_verse = self._extract_memory_verse(soup)
        data['memory_verse_content'] = memory_verse['content']
        data['memory_verse_passage'] = memory_verse['passage']
        
        # Bible Reading
        bible_reading = self._extract_bible_reading(soup)
        data['bible_text_passage'] = bible_reading['passage']
        data['bible_text_content'] = bible_reading['content']
        
        # Main Message
        data['content'] = self._extract_message(soup)
        
        # Key Point
        data['key_point'] = self._extract_key_point(soup)
        
        # Bible in One Year
        data['bible_in_one_year'] = self._extract_bible_in_one_year(soup)
        
        # Hymn
        data['hymn'] = self._extract_hymn(soup)
        
        # Backwards compatibility fields
        data['anchor_scripture'] = data['memory_verse_passage']
        data['scripture_text'] = data['memory_verse_content']
        
        # Log extraction results
        extracted_fields = [k for k, v in data.items() if v and k not in ['date', 'source_url', 'status', 'author', 'slug']]
        logger.info(f"Extracted fields for {target_date}: {', '.join(extracted_fields)}")
        
        return data
    
    def validate_data(self, data: Dict[str, Any]) -> bool:
        """Validate that required fields are present and not empty."""
        missing_fields = []
        for field in self.REQUIRED_FIELDS:
            if not data.get(field):
                missing_fields.append(field)
        
        if missing_fields:
            logger.error(f"Missing required fields: {', '.join(missing_fields)}")
            return False
        
        return True
    
    def scrape(self, target_date: date) -> Optional[Dict[str, Any]]:
        """Scrape devotional for a specific date."""
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
        
        data = self.parse_html(html, target_date, url)
        
        if not data:
            return None
        
        # Validate data before returning
        if not self.validate_data(data):
            logger.error(f"Validation failed for devotional on {target_date}")
            return None
        
        return data


def scrape_and_save_devotional(target_date: date = None) -> Optional[dict]:
    """
    Scrape a devotional and save it to the database.
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
        logger.error(f"Error saving devotional for {target_date}: {e}", exc_info=True)
        return None