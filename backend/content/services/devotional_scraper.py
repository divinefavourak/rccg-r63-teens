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
from typing import Optional, Dict, Any

import requests
from bs4 import BeautifulSoup
from django.utils.text import slugify

logger = logging.getLogger(__name__)


class DevotionalScraper:
    """
    Scraper for Teen Open Heaven devotionals from openheavens.com.ng.
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
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        })
    
    def build_url(self, target_date: date) -> str:
        return self.BASE_URL_TEMPLATE.format(
            year=target_date.year,
            month=target_date.month,
            day=target_date.day,
            month_name=self.MONTH_NAMES[target_date.month]
        )
    
    def build_alt_urls(self, target_date: date) -> list:
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
        try:
            response = self.session.get(url, timeout=self.timeout)
            if response.status_code == 404:
                logger.warning(f"Devotional page not found: {url}")
                return None
            response.raise_for_status()
            return response.text
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching {url}: {e}")
            return None
    
    def _clean_text(self, text: str) -> str:
        """Clean extracted text by removing extra whitespace and HTML artifacts."""
        if not text:
            return ''
        text = re.sub(r'\s+', ' ', text).strip()
        text = re.sub(r'&nbsp;', ' ', text)
        text = re.sub(r'&amp;', '&', text)
        text = re.sub(r'&lt;', '<', text)
        text = re.sub(r'&gt;', '>', text)
        return text

    def parse_html(self, html: str, target_date: date, source_url: str) -> Optional[Dict[str, Any]]:
        """
        Parse the HTML content using regex patterns to match the "Open Heavens" format.
        """
        soup = BeautifulSoup(html, 'html.parser')
        
        # Find the main content container
        article = soup.find('div', class_='entry-content') or soup.find('article') or soup.find('div', class_='post-content')
        
        if not article:
            logger.warning(f"Could not find article container for {source_url}")
            return None

        # Get text with newlines preserved to help regex matching
        text_content = article.get_text(separator='\n')
        
        data = {
            'date': target_date,
            'source_url': source_url,
            'status': 'published',
            'author': 'Pastor E.A. Adeboye',
        }

        # 1. THEME (Title)
        # Matches: "THEME: FROM GOOD TO VERY GOOD"
        theme_match = re.search(r'THEME:\s*(.+)', text_content, re.IGNORECASE)
        if theme_match:
            data['title'] = self._clean_text(theme_match.group(1))
        else:
            # Fallback to H1
            h1 = soup.find('h1')
            data['title'] = self._clean_text(h1.get_text()) if h1 else 'Open Heavens Devotional'
        
        data['slug'] = slugify(f"{target_date}-{data['title']}")[:300]

        # 2. MEMORISE (Content + Reference)
        # Matches: "verse text" - Reference  OR  verse text \n Reference
        mem_match = re.search(r'MEMORISE:[\s\n]*["\']?(.+?)["\']?[\s\n]*[-–—]?[\s\n]*([1-9]?[A-Za-z]+\s+\d+:\d+[a-z]?)', text_content, re.DOTALL | re.IGNORECASE)
        if mem_match:
            data['memory_verse_content'] = self._clean_text(mem_match.group(1))
            data['memory_verse_passage'] = self._clean_text(mem_match.group(2))
        else:
            data['memory_verse_content'] = ''
            data['memory_verse_passage'] = ''

        # 3. BIBLE READING (Passage + Content)
        # Matches: "BIBLE READING: 2 KINGS 4:8-17"
        read_match = re.search(r'BIBLE READING:[\s\n]*([1-9]?[A-Za-z]+\s+\d+:\d+(?:-\d+)?)', text_content, re.IGNORECASE)
        if read_match:
            data['bible_text_passage'] = self._clean_text(read_match.group(1))
            
            # Extract the Bible text block (between BIBLE READING line and MESSAGE line)
            full_pattern = re.search(r'BIBLE READING:.*?[\n\r](.+?)[\n\r]\s*(?:MESSAGE|HYMN|KEY POINT)', text_content, re.DOTALL | re.IGNORECASE)
            if full_pattern:
                # The match includes the text. We clean it up.
                raw_text = full_pattern.group(1)
                # Remove the passage title if it got captured
                raw_text = raw_text.replace(data['bible_text_passage'], '')
                data['bible_text_content'] = self._clean_text(raw_text)
            else:
                data['bible_text_content'] = ''
        else:
            data['bible_text_passage'] = ''
            data['bible_text_content'] = ''

        # 4. MESSAGE (Main Content)
        # Captures everything between MESSAGE: and the next section (KEY POINT, PRAYER, etc.)
        msg_match = re.search(r'MESSAGE:[\s\n]*(.+?)[\s\n]*(?:KEY POINT|PRAYER|HYMN|BIBLE IN ONE YEAR)', text_content, re.DOTALL | re.IGNORECASE)
        if msg_match:
            data['content'] = self._clean_text(msg_match.group(1))
        else:
            # Fallback: if we can't parse structure, dump everything (not ideal but better than empty)
            data['content'] = ""

        # 5. KEY POINT
        kp_match = re.search(r'KEY POINT:[\s\n]*(.+?)(?:[\n]|$|BIBLE IN ONE YEAR|HYMN|AUTHOR)', text_content, re.DOTALL | re.IGNORECASE)
        data['key_point'] = self._clean_text(kp_match.group(1)) if kp_match else ''

        # 6. BIBLE IN ONE YEAR
        bioy_match = re.search(r'BIBLE IN ONE YEAR:[\s\n]*(.+?)(?:[\n]|$|HYMN|AUTHOR)', text_content, re.DOTALL | re.IGNORECASE)
        data['bible_in_one_year'] = self._clean_text(bioy_match.group(1)) if bioy_match else ''

        # 7. HYMN (Full Lyrics)
        # Captures "HYMN X: TITLE" followed by lyrics until end of section
        hymn_match = re.search(r'(HYMN\s*\d*:?.+?)(?:[\n]|$|BIBLE IN ONE YEAR)', text_content, re.DOTALL | re.IGNORECASE)
        if hymn_match:
            # We want to preserve newlines for lyrics, so we don't use _clean_text which strips them
            raw_hymn = hymn_match.group(1).strip()
            # Basic cleanup but keep structure
            raw_hymn = re.sub(r'&nbsp;', ' ', raw_hymn)
            data['hymn'] = raw_hymn
        else:
            data['hymn'] = ''

        # Backwards compatibility fields (Optional)
        data['anchor_scripture'] = data.get('memory_verse_passage', '')
        data['scripture_text'] = data.get('memory_verse_content', '')

        return data
    
    def scrape(self, target_date: date) -> Optional[Dict[str, Any]]:
        """
        Scrape devotional for a specific date.
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
