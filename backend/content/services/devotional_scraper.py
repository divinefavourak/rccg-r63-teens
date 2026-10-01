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

    def _title_suffixes(self, title: str) -> List[str]:
        """Generate URL-suffix candidates from a title hint.

        openheavens.com.ng appends the first word(s) of the title as a slug
        suffix, e.g. "Set Boundaries" → open-heaven-for-teens-24-may-2026-set.html
        We produce a short ranked list to try without too many extra requests.
        """
        words = re.findall(r'[a-zA-Z]+', title.lower())
        if not words:
            return []
        candidates = [
            words[0],                   # "set"
            '-'.join(words[:2]),        # "set-boundaries"
            '-'.join(words),            # full slug
        ]
        return list(dict.fromkeys(candidates))

    def build_candidate_urls(self, target_date: date, title_hint: str = None) -> List[str]:
        """Return all candidate URLs in priority order, deduplicated."""
        day = target_date.day
        month = target_date.month
        year = target_date.year
        month_name = self.MONTH_NAMES[month]
        month_name_short = self.MONTH_NAMES_SHORT[month]
        base = f"https://www.openheavens.com.ng/{year}/{month:02d}/"

        candidates = [
            f"{base}open-heaven-for-teens-{day}-{month_name}-{year}.html",
            f"{base}open-heaven-for-teens-{day:02d}-{month_name}-{year}.html",
            f"{base}teen-open-heaven-{day}-{month_name}-{year}.html",
            f"{base}open-heaven-for-teens-{day}-{month_name_short}-{year}.html",
        ]

        if title_hint:
            for suffix in self._title_suffixes(title_hint):
                candidates.append(
                    f"{base}open-heaven-for-teens-{day}-{month_name}-{year}-{suffix}.html"
                )
                candidates.append(
                    f"{base}open-heaven-for-teens-{day:02d}-{month_name}-{year}-{suffix}.html"
                )

        return list(dict.fromkeys(candidates))
    
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
        
        # Find all leaf-level text elements.
        # Do NOT include 'div' — container divs return all nested text concatenated,
        # causing section boundaries to bleed into one another.
        #
        # Outermost only. A label is usually marked up as
        # `<p><strong>MESSAGE</strong></p>`, which find_all returns twice — once
        # as the p and once as the nested strong. The p opened the section and
        # the strong was then captured as *content*, so every section's body
        # began with its own label ("MESSAGE THIS IS THE MAIN…"). Keeping only
        # the outermost element also handles the common
        # `<p><strong>MEMORISE:</strong> For God so loved…</p>` shape correctly,
        # because the p carries both the label and the text after it.
        SECTION_TAGS = ['p', 'strong', 'b', 'h1', 'h2', 'h3', 'h4']
        all_elements = [
            el for el in soup.find_all(SECTION_TAGS)
            if not any(parent.name in SECTION_TAGS for parent in el.parents)
        ]


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
        """Extract the theme/title of the devotional.

        The site uses 'TOPIC:' (not 'THEME:') in an <h2> tag, e.g.:
        'TOPIC: Flee Sexual Immorality (Open Heaven for Teens, 4 March 2026)'
        """
        for elem in soup.find_all(['p', 'strong', 'b', 'h1', 'h2', 'h3']):
            text = elem.get_text().strip()
            # Match both TOPIC: and THEME:
            if re.match(r'^\s*(TOPIC|THEME):', text, re.IGNORECASE):
                title = re.sub(r'^\s*(TOPIC|THEME):\s*', '', text, flags=re.IGNORECASE)
                # Strip trailing date info like "(Open Heaven for Teens, 4 March 2026)"
                title = re.sub(r'\s*\(Open Heaven for Teens[^)]*\)', '', title, flags=re.IGNORECASE)
                return self._clean_text(title.strip())

        # Fallback: first H2 that contains 'TOPIC' anywhere
        for h2 in soup.find_all('h2'):
            text = h2.get_text().strip()
            if 'TOPIC' in text.upper() or 'THEME' in text.upper():
                title = re.sub(r'^\s*(TOPIC|THEME):\s*', '', text, flags=re.IGNORECASE)
                title = re.sub(r'\s*\(Open Heaven for Teens[^)]*\)', '', title, flags=re.IGNORECASE)
                return self._clean_text(title.strip())

        # Fallback to H1
        h1 = soup.find('h1')
        if h1:
            return self._clean_text(h1.get_text())

        return None
    
    def _extract_memory_verse(self, soup: BeautifulSoup) -> Dict[str, str]:
        """Extract memory verse content and reference.

        Handles several trailing-reference formats:
          - "verse text - Book chapter:verse"
          - "verse text (Book chapter:verse)"
          - "verse text. Book chapter:verse"   ← common on this site
          - "verse text Book chapter:verse"    ← no separator
        """
        result = {'content': '', 'passage': ''}

        content = self._find_section_content(soup, 'MEMORISE', ['BIBLE READING', 'READ'])
        if not content:
            return result

        # Bible reference pattern: optional book-number prefix, book name, chapter:verse
        REF = r'([1-3]?\s*[A-Za-z]+\.?\s+\d+:\d+[a-z]?(?:[–\-]\d+[a-z]?)?)'

        patterns = [
            # dash separator: "verse text - Genesis 39:12"
            rf'^(.+?)\s*[-–—]\s*{REF}\s*$',
            # parentheses: "verse text (Genesis 39:12)"
            rf'^(.+?)\s*\({REF}\)\s*$',
            # period separator: "verse text. Genesis 39:12"
            rf'^(.+?)\.\s+{REF}\s*$',
            # space only: "verse text Genesis 39:12"
            rf'^(.+?)\s+{REF}\s*$',
        ]

        for pattern in patterns:
            match = re.search(pattern, content, re.DOTALL)
            if match:
                result['content'] = self._clean_text(match.group(1).strip('"\''))
                result['passage'] = self._clean_text(match.group(2))
                return result

        # No pattern matched — store the full text as content
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
        if not content:
            return ''
        # Strip inline ads
        content = re.sub(r'God[- ]centered merchandise', '', content, flags=re.IGNORECASE)
        content = re.sub(r'Also Read:.*?(?=\s{2,}|\Z)', '', content, flags=re.IGNORECASE | re.DOTALL)
        return self._clean_text(content)
    
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
        """Extract hymn title and lyrics, preserving line breaks.

        Hymn content is spread across many individual <p> tags (one per line).
        _find_section_content joins them with spaces, losing structure.
        We therefore walk elements directly from the HYMN heading.
        """
        HYMN_TAGS = ['p', 'strong', 'b', 'h1', 'h2', 'h3', 'h4']
        # Outermost elements only. `<p><strong>HYMN 3: Amazing Grace</strong></p>`
        # yields both the p and the strong, so without this the heading — and
        # every emphasised line in a stanza — is appended twice.
        all_elements = [
            el for el in soup.find_all(HYMN_TAGS)
            if not any(parent.name in HYMN_TAGS for parent in el.parents)
        ]
        lines = []
        capturing = False

        # Every other section label, not just the ones that happen to follow the
        # hymn on a typical page.
        #
        # This list previously held only BIBLE IN ONE YEAR / AUTHOR / PRAYER /
        # DAILY DEVOTIONAL. MESSAGE was absent, so once capture started there was
        # nothing to stop it running straight through the body of the devotional
        # — which is how the main message ended up stored as the hymn.
        stop_labels = [
            'MESSAGE', 'KEY POINT', 'MEMORISE', 'MEMORIZE',
            'BIBLE READING', 'BIBLE IN ONE YEAR',
            'PRAYER POINT', 'PRAYER', 'ACTION POINT', 'CONFESSION',
            'AUTHOR', 'DAILY DEVOTIONAL',
        ]

        # A real HYMN heading is a label: "HYMN", "HYMN 3", "HYMN 3: Amazing
        # Grace" — the title, when present, is introduced by a colon, like every
        # other section label on the page.
        #
        # Matching anything that merely *starts with* "HYMN" also matched
        # related-post links such as "Hymn 12 - Blessed Assurance", and since the
        # walk covers the whole document a single stray match above the real
        # section opened capture early. Requiring the colon separates the heading
        # from a link that happens to name a hymn.
        HYMN_LABEL = re.compile(r'^\s*HYMN\s*\d*\s*(?::\s*(.{0,80}))?\s*$', re.IGNORECASE)

        for elem in all_elements:
            text = elem.get_text().strip()
            if not text:
                if capturing:
                    lines.append('')  # preserve blank lines between stanzas
                continue

            if not capturing:
                # A heading is never a link. Skipping anchors keeps navigation
                # and related-post lists out of the hymn.
                if elem.find_parent('a') is not None:
                    continue
                match = HYMN_LABEL.match(text)
                if match:
                    capturing = True
                    title = (match.group(1) or '').strip()
                    if title:
                        lines.append(title)
                continue

            # Word-boundary match, so a hymn line containing "prayerful" does not
            # terminate the stanza on "PRAYER".
            if any(re.search(rf'\b{re.escape(stop)}\b', text, re.IGNORECASE) for stop in stop_labels):
                break

            lines.append(text)

        # Strip inline ad text that bleeds into content lines
        AD_PATTERNS = re.compile(
            r'God[- ]centered merchandise|Also Read:.*|Click HERE.*',
            re.IGNORECASE
        )
        lines = [AD_PATTERNS.sub('', line).strip() for line in lines]

        # Remove trailing blank lines
        while lines and not lines[-1]:
            lines.pop()

        return '\n'.join(lines)
    
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
    
    def discover_url_from_archive(self, target_date: date) -> Optional[str]:
        """
        Scrape the monthly archive page to discover the actual URL for a given date.
        Handles URLs with unpredictable suffixes like '-flee', '-grace', etc.
        e.g. open-heaven-for-teens-4-march-2026-flee.html
        """
        archive_url = (
            f"https://www.openheavens.com.ng/{target_date.year}/{target_date.month:02d}/"
        )
        html = self.fetch_page(archive_url)
        if not html:
            return None

        soup = BeautifulSoup(html, 'html.parser')
        day = target_date.day
        month_name = self.MONTH_NAMES[target_date.month]
        year = target_date.year

        # Match links like: open-heaven-for-teens-{day}-{month}-{year}[anything].html
        pattern = re.compile(
            rf'open-heaven-for-teens-0?{day}-{month_name}-{year}',
            re.IGNORECASE
        )

        for a in soup.find_all('a', href=True):
            href = a['href']
            if pattern.search(href) and '#' not in href:
                logger.info(f"Discovered URL from archive: {href}")
                return href

        logger.warning(f"No URL found in archive for {target_date}")
        return None

    def scrape(self, target_date: date, title_hint: str = None) -> Optional[Dict[str, Any]]:
        """Scrape devotional for a specific date.

        title_hint — optional title string from rccgonline.org used to build
        suffix-based URL guesses (e.g. "Set Boundaries" → -set suffix).
        """
        # Archive discovery handles unpredictable suffixes without needing a hint
        discovered_url = self.discover_url_from_archive(target_date)
        if discovered_url:
            html = self.fetch_page(discovered_url)
            if html:
                data = self.parse_html(html, target_date, discovered_url)
                if data and self.validate_data(data):
                    return data
                logger.warning(f"Archive URL found but parse/validation failed for {target_date}")

        # Try all deduplicated candidate URLs, with title-hint suffixes appended
        for url in self.build_candidate_urls(target_date, title_hint):
            logger.info(f"Trying candidate URL: {url}")
            html = self.fetch_page(url)
            if html:
                data = self.parse_html(html, target_date, url)
                if data and self.validate_data(data):
                    return data

        logger.warning(f"Could not fetch devotional for {target_date} from any URL")
        return None


class RCCGOnlineScraper:
    """
    Scraper for Teen Open Heaven devotionals from rccgonline.org.

    URL format: https://rccgonline.org/open-heavens-for-teens-{day}-{month}-{year}/
    Labels are prefixed with "OPEN HEAVENS FOR TEENS D MONTH YYYY ".
    """

    BASE_URL = "https://rccgonline.org/open-heavens-for-teens-{day}-{month}-{year}/"

    MONTH_NAMES = {
        1: 'january', 2: 'february', 3: 'march', 4: 'april',
        5: 'may', 6: 'june', 7: 'july', 8: 'august',
        9: 'september', 10: 'october', 11: 'november', 12: 'december',
    }

    HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }

    # Regex to strip "OPEN HEAVENS FOR TEENS D MONTH YYYY [WEEKDAY:] " prefix from any label
    _DATE_PREFIX = re.compile(
        r'^open\s+heavens?\s+for\s+teens?\s+\d{1,2}\s+\w+\s+\d{4}\s*(?:\w+:)?\s*',
        re.IGNORECASE,
    )

    def build_url(self, target_date: date) -> str:
        return self.BASE_URL.format(
            day=target_date.day,
            month=self.MONTH_NAMES[target_date.month],
            year=target_date.year,
        )

    def fetch_page(self, url: str) -> Optional[str]:
        try:
            r = requests.get(url, headers=self.HEADERS, timeout=20)
            if r.status_code == 404:
                logger.warning(f"[RCCGOnline] 404: {url}")
                return None
            r.raise_for_status()
            return r.text
        except requests.exceptions.RequestException as e:
            logger.error(f"[RCCGOnline] Fetch error {url}: {e}")
            return None

    def _strip_prefix(self, text: str) -> str:
        """Remove the date prefix from a section label."""
        return self._DATE_PREFIX.sub('', text).strip(' :\t')

    def _get_article(self, soup: BeautifulSoup):
        return (
            soup.find('div', class_='entry-content') or
            soup.find('article') or
            soup.find('div', class_='post-content') or
            soup.find('main')
        )

    def _get_content_lines(self, article) -> list:
        """
        Return text from <p>, <h2>, <h3>, <h4> tags in document order.
        Including heading tags is necessary because section labels like MESSAGE
        appear in <h2> on this site, not <p>.
        Deduplicates by full text to skip <strong> mirror tags.
        """
        seen = set()
        texts = []
        for tag in article.find_all(['p', 'h2', 'h3', 'h4']):
            t = tag.get_text().strip()
            if t and t not in seen:
                seen.add(t)
                texts.append(t)
        return texts

    def parse_html(self, html: str, target_date: date, source_url: str) -> Optional[Dict[str, Any]]:
        soup = BeautifulSoup(html, 'html.parser')
        article = self._get_article(soup)
        if not article:
            logger.warning(f"[RCCGOnline] No article container found for {source_url}")
            return None

        data: Dict[str, Any] = {
            'date': target_date,
            'source_url': source_url,
            'status': 'published',
            'author': 'Pastor E.A. Adeboye',
        }

        # ── Title ──────────────────────────────────────────────────────────────
        h1 = article.find('h1')
        if h1:
            raw = h1.get_text().strip()
            # Strip full prefix including weekday: "OPEN HEAVENS FOR TEENS 4 MARCH 2026 WEDNESDAY: "
            title = re.sub(
                r'^open\s+heavens?\s+for\s+teens?\s+\d{1,2}\s+\w+\s+\d{4}\s+\w+:\s*',
                '', raw, flags=re.IGNORECASE,
            ).strip().title()
        else:
            title = f"Open Heaven for Teens - {target_date.strftime('%B %d, %Y')}"
        data['title'] = title
        data['slug'] = slugify(f"{target_date}-{title}")[:300]

        # Work with deduplicated content lines (p + headings)
        lines = self._get_content_lines(article)

        # ── Memory verse ───────────────────────────────────────────────────────
        mem_content = ''
        mem_passage = ''
        for i, line in enumerate(lines):
            if re.search(r'MEMORISE', line, re.IGNORECASE):
                raw_verse = self._strip_prefix(line)
                # Reference is often in the next <strong> after the <p>
                # But we can also try to split it from the text
                ref_match = re.search(
                    r'([1-3]?\s*[A-Za-z]+\.?\s+\d+:\d+[a-z]?(?:[–\-]\d+[a-z]?)?)\s*$',
                    raw_verse,
                )
                if ref_match:
                    mem_passage = ref_match.group(1).strip()
                    mem_content = raw_verse[:ref_match.start()].strip().strip('"\'')
                else:
                    mem_content = raw_verse
                    # Try next line for just the reference
                    if i + 1 < len(lines):
                        next_line = lines[i + 1].strip()
                        if re.match(r'^[1-3]?\s*[A-Za-z]+\.?\s+\d+:\d+', next_line):
                            mem_passage = next_line
                break
        data['memory_verse_content'] = mem_content
        data['memory_verse_passage'] = mem_passage
        data['scripture_text'] = mem_content
        data['anchor_scripture'] = mem_passage

        # ── Bible reading ──────────────────────────────────────────────────────
        bible_passage = ''
        bible_content_lines = []
        in_bible = False
        for line in lines:
            if re.search(r'BIBLE READING', line, re.IGNORECASE) and not in_bible:
                raw = self._strip_prefix(line)
                # Passage is what's left after stripping prefix (e.g. "1 CORINTHIANS 6:16-18")
                bible_passage = raw.strip().title()
                in_bible = True
                continue
            if in_bible:
                if re.search(r'MESSAGE|KEY POINT|HYMN|BIBLE IN ONE YEAR', line, re.IGNORECASE):
                    break
                # Skip cross-ref lines like "Open Heaven 4 March 2026"
                if re.search(r'open heaven', line, re.IGNORECASE):
                    continue
                bible_content_lines.append(line.strip())
        data['bible_text_passage'] = bible_passage
        data['bible_text_content'] = ' '.join(bible_content_lines)

        # ── Message ────────────────────────────────────────────────────────────
        message_lines = []
        in_message = False
        for line in lines:
            if re.search(r'\bMESSAGE\b', line, re.IGNORECASE) and not in_message:
                in_message = True
                continue
            if in_message:
                if re.search(r'KEY POINT|HYMN|BIBLE IN ONE YEAR', line, re.IGNORECASE):
                    break
                # Skip cross-ref ads
                if re.search(r'^open heaven\b', line, re.IGNORECASE):
                    continue
                message_lines.append(line.strip())
        data['content'] = '\n\n'.join(message_lines)

        # ── Key point ──────────────────────────────────────────────────────────
        # Some <p> tags contain "KEY POINT: ... \n\n HYMN: ..." all in one block.
        # We strip the label then take only the first non-empty line.
        key_point = ''
        for i, line in enumerate(lines):
            if re.search(r'KEY POINT', line, re.IGNORECASE):
                after = self._strip_prefix(line)
                # Strip remaining "KEY POINT:" label that _strip_prefix may leave
                after = re.sub(r'^key\s*point\s*:?\s*', '', after, flags=re.IGNORECASE)
                # Take only the first non-empty line (avoid bleeding into HYMN section)
                first_line = next((l.strip() for l in after.splitlines() if l.strip()), '')
                if first_line:
                    key_point = first_line
                elif i + 1 < len(lines):
                    candidate = lines[i + 1]
                    if not re.search(r'HYMN|BIBLE IN ONE YEAR', candidate, re.IGNORECASE):
                        key_point = candidate.strip()
                break
        data['key_point'] = key_point

        # ── Bible in one year ──────────────────────────────────────────────────
        # Some lines embed BIBLE IN ONE YEAR mid-text (inside a big <p> that also
        # contains KEY POINT and HYMN). Extract only the inline reference value
        # (up to the next newline) rather than taking the whole line.
        bioy = ''
        for line in lines:
            if re.search(r'BIBLE IN ONE YEAR', line, re.IGNORECASE):
                m = re.search(r'BIBLE\s+IN\s+ONE\s+YEAR\s*:\s*([^\n]+)', line, re.IGNORECASE)
                if m:
                    bioy = m.group(1).strip().title()
                break
        data['bible_in_one_year'] = bioy

        # ── Hymn ───────────────────────────────────────────────────────────────
        hymn_lines = []
        in_hymn = False
        seen_hymn = set()
        for line in lines:
            if re.search(r'\bHYMN\b', line, re.IGNORECASE) and not in_hymn:
                # Title line: strip prefix and hymn number
                title_part = re.sub(r'.*HYMN\s*\d*:\s*', '', line, flags=re.IGNORECASE).strip()
                if title_part and title_part not in seen_hymn:
                    hymn_lines.append(title_part.title())
                    seen_hymn.add(title_part)
                in_hymn = True
                continue
            if in_hymn:
                if re.search(r'BIBLE IN ONE YEAR|OPEN HEAVENS FOR TEENS', line, re.IGNORECASE):
                    break
                if line and line not in seen_hymn:
                    hymn_lines.append(line)
                    seen_hymn.add(line)
        data['hymn'] = '\n'.join(hymn_lines)

        logger.info(f"[RCCGOnline] Parsed {target_date}: title='{title}', passage='{mem_passage}'")
        return data

    def scrape(self, target_date: date, require_content: bool = True) -> Optional[Dict[str, Any]]:
        """Scrape rccgonline.org for target_date.

        When require_content=False, returns partial data (title + memory verse)
        even if the message body is missing — useful as a title hint for the
        openheavens.com.ng URL suffix guesser.
        """
        url = self.build_url(target_date)
        logger.info(f"[RCCGOnline] Scraping {target_date} from {url}")
        html = self.fetch_page(url)
        if not html:
            return None
        data = self.parse_html(html, target_date, url)
        if not data or not data.get('title'):
            logger.warning(f"[RCCGOnline] No title found for {target_date}")
            return None
        if require_content and not data.get('content'):
            logger.warning(f"[RCCGOnline] Incomplete data (no message content) for {target_date}")
            return None
        return data


def scrape_and_save_devotional(target_date: date = None, force: bool = False) -> Optional[dict]:
    """
    Scrape a devotional and save it to the database.
    If force=True, replaces an existing record only after a successful scrape.

    Scraping strategy (single rccgonline.org HTTP request):
    1. Fetch rccgonline.org with require_content=False to get title + memory verse.
    2. If the page has a full message body, use it directly (done).
    3. Otherwise, pass the title as a suffix hint to DevotionalScraper which
       tries openheavens.com.ng with both guessed and title-based URLs.
    4. If all sources fail but we have a title + memory verse from rccgonline,
       save a 'draft' so it can be completed later by an admin.
    """
    from content.models import Devotional

    if target_date is None:
        target_date = date.today()

    if Devotional.objects.filter(date=target_date).exists() and not force:
        logger.info(f"Devotional for {target_date} already exists, skipping.")
        return None

    # One rccgonline request gives us either full data or a title hint
    partial_rccg = RCCGOnlineScraper().scrape(target_date, require_content=False)

    if partial_rccg and partial_rccg.get('content'):
        data = partial_rccg
    else:
        title_hint = partial_rccg.get('title') if partial_rccg else None
        logger.info(
            f"[RCCGOnline] No full content for {target_date}, trying openheavens.com.ng"
            + (f" with title hint: '{title_hint}'" if title_hint else "")
        )
        data = DevotionalScraper().scrape(target_date, title_hint=title_hint)

        if not data:
            # Save partial data as a draft so admins can complete it
            if partial_rccg and partial_rccg.get('title') and partial_rccg.get('memory_verse_content'):
                partial_rccg['status'] = 'draft'
                data = partial_rccg
                logger.warning(
                    f"Saving partial draft for {target_date}: title='{partial_rccg['title']}'"
                )
            else:
                logger.warning(f"Failed to scrape devotional for {target_date} from all sources")
                return None

    # Remove source_url from data as it's not a model field
    source_url = data.pop('source_url', '')

    # Truncate any CharField-limited values to avoid DB overflow
    CHAR_LIMITS = {
        'title': 255, 'memory_verse_passage': 255, 'bible_text_passage': 255,
        'bible_in_one_year': 255, 'anchor_scripture': 255, 'author': 255, 'key_point': 500,
    }
    for field, max_len in CHAR_LIMITS.items():
        if field in data and isinstance(data.get(field), str):
            data[field] = data[field][:max_len]

    try:
        if force:
            deleted, _ = Devotional.objects.filter(date=target_date).delete()
            if deleted:
                logger.info(f"Replaced existing devotional for {target_date}")

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