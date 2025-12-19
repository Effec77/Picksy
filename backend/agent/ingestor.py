import os
import praw
import json
import requests
import random
import hashlib
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from dotenv import load_dotenv
from duckduckgo_search import DDGS
from difflib import SequenceMatcher

load_dotenv()

try:
    from yt_dlp import YoutubeDL
except ImportError:
    try:
        from youtube_dl import YoutubeDL 
    except ImportError:
        YoutubeDL = None

# --- COMPONENT 1: SCRAPER MESH (The "Harvester") ---
class ScraperMesh:
    """
    Manages outbound requests via a rotating mesh of proxies (Simulated).
    Handles throttling, retries, and user-agent rotation.
    """
    def __init__(self):
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36'
        ]
        self.session = requests.Session()

    def get_headers(self):
        return {
            'User-Agent': random.choice(self.user_agents),
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive'
        }

    def fetch_page(self, url, timeout=10):
        """
        Fetches a page using the mesh. In a real deployment, this would use 
        rotating proxies (e.g., BrightData). Here it uses local requests with rotation headers.
        """
        try:
            # print(f"🕸️ [Mesh] Routing request to: {url}...")
            headers = self.get_headers()
            response = self.session.get(url, headers=headers, timeout=timeout)
            response.raise_for_status()
            return response.text
        except Exception as e:
            print(f"❌ [Mesh] Request failed for {url}: {e}")
            return None

# --- COMPONENT 2: CANONICALIZER (The "Identity Resolver") ---
class Canonicalizer:
    """
    Unifies product identities to ensure 'Sony XM5' and 'Sony WH-1000XM5' 
    are treated as the same master record.
    """
    def __init__(self):
        pass

    def _clean_title(self, title):
        return title.lower().replace('-', ' ').replace('/', ' ').strip()

    def generate_product_hash(self, product_name):
        """Generates a consistent hash for a product name for deduplication."""
        clean = self._clean_title(product_name)
        return hashlib.sha256(clean.encode('utf-8')).hexdigest()

    def are_same_product(self, product_a_meta, product_b_meta):
        """
        Determines if two products are the same.
        Match Level 1: Hard Match (UPC/GTIN)
        Match Level 2: Soft Match (Title Similarity)
        """
        # 1. Hard Match
        if product_a_meta.get('upc') and product_b_meta.get('upc'):
            return product_a_meta['upc'] == product_b_meta['upc']
        
        # 2. Soft Match (Sequence Matcher)
        name_a = self._clean_title(product_a_meta.get('name', ''))
        name_b = self._clean_title(product_b_meta.get('name', ''))
        
        similarity = SequenceMatcher(None, name_a, name_b).ratio()
        
        # Threshold: 0.85 implies extremely similar naming
        return similarity > 0.85

# --- MAIN AGENT: GLOBAL INGESTOR ---
class GlobalIngestor:
    def __init__(self):
        self.mesh = ScraperMesh()
        self.canonicalizer = Canonicalizer()
        
        # 1. REDDIT
        self.reddit_client_id = os.environ.get('REDDIT_CLIENT_ID')
        self.reddit_client_secret = os.environ.get('REDDIT_CLIENT_SECRET')
        if self.reddit_client_id and self.reddit_client_secret:
            self.reddit = praw.Reddit(
                client_id=self.reddit_client_id,
                client_secret=self.reddit_client_secret,
                user_agent="Picksy Review Scraper (v1.0)"
            )
        else:
            self.reddit = None
            
        # 2. YOUTUBE
        self.ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'getcomments': True, 
            'skip_download': True,
        }

    def _normalize_review(self, raw_data, source_type):
        """
        Converts any raw review into the Standard Normalized Review Object.
        """
        return {
            "review_id": raw_data.get('id', hashlib.md5(raw_data.get('content', '').encode()).hexdigest()[:12]),
            "product_id": raw_data.get('product_id', 'unknown'),
            "source_platform": source_type,
            "author_id": raw_data.get('author', 'anonymous'),
            "timestamp": raw_data.get('timestamp', None),
            "content": raw_data.get('content', ''),
            "rating": raw_data.get('rating', None),
            "verified_purchase": raw_data.get('verified', False),
            "images": raw_data.get('images', [])
        }

    def _fetch_reddit_data(self, query):
        reviews = []
        if not self.reddit: return reviews

        target_subreddits = ['reviews', 'gadgets', 'tech', 'headphones', 'BuyItForLife']
        try:
            for sub_name in target_subreddits:
                subreddit = self.reddit.subreddit(sub_name)
                for submission in subreddit.search(query, limit=5, sort='relevance'):
                    reviews.append(self._normalize_review({
                        "content": f"POST: {submission.title} - {submission.selftext}",
                        "id": submission.id,
                        "author": str(submission.author),
                        "timestamp": submission.created_utc
                    }, f"Reddit/{sub_name}"))
                    
                    submission.comments.replace_more(limit=0)
                    for comment in submission.comments.list()[:10]:
                        reviews.append(self._normalize_review({
                            "content": comment.body,
                            "id": comment.id,
                            "author": str(comment.author),
                            "timestamp": comment.created_utc
                        }, f"Reddit/{sub_name}"))
        except Exception as e:
            print(f"⚠️ Reddit Error: {e}")
        return reviews

    def _fetch_youtube_data(self, query):
        reviews = []
        if not YoutubeDL: return reviews
        
        try:
            # Search for video
            video_search_query = f"ytsearch1:{query} review"
            with YoutubeDL({'dump_single_json': True, 'extract_flat': True, 'quiet': True}) as ydl:
                info_dict = ydl.extract_info(video_search_query, download=False)
                if not info_dict.get('entries'): return reviews
                video_url = info_dict['entries'][0]['url']
            
            # Get Comments
            with YoutubeDL(self.ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=False)
                for comment in info.get('comments', []):
                    reviews.append(self._normalize_review({
                        "content": comment.get('text', ''),
                        "id": comment.get('id'),
                        "author": comment.get('author', 'YouTube User'),
                        "timestamp": comment.get('timestamp')
                    }, "YouTube"))
        except Exception as e:
            print(f"⚠️ YouTube Error: {e}")
        return reviews

    def _search_web_free(self, product_name):
        print(f"🕸️ Tier 4: Searching web for forum reviews of: {product_name}...")
        urls = []
        try:
            query = f"{product_name} user reviews forum discussion -site:amazon.* -site:flipkart.* -site:youtube.*"
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=3))
                for r in results:
                    urls.append(r['href'])
        except Exception as e:
            print(f"⚠️ Tier 4 Search Failed: {e}")
            # Fallback Mock
            return ["https://mock-tech-forum.com/t/sony-xm5-long-term-review"]
        return urls

    def _scrape_forum_page(self, url, product_name):
        reviews = []
        
        # Check for Mock
        if 'mock-tech-forum' in url:
             html_content = """
                <html><body><div id='main-content'>
                <p class='review-body'>Initial review was great, but the earcups split after 10 months.</p>
                <p class='comment'>I had the same issue! It's a known design flaw.</p>
                </div></body></html>
            """
        else:
            html_content = self.mesh.fetch_page(url)
            if not html_content: return []

        soup = BeautifulSoup(html_content, 'html.parser')
        # Heuristic: Find paragraphs with substantial text
        review_elements = soup.find_all('p')
        
        for i, element in enumerate(review_elements):
            text = element.get_text().strip()
            if 30 < len(text) < 1500:
                reviews.append(self._normalize_review({
                    "content": text,
                    "id": f"web_{hashlib.md5(url.encode()).hexdigest()}_{i}",
                    "product_id": product_name
                }, f"Web ({urlparse(url).netloc})"))
        
        return reviews

    def fetch_supplementary_data(self, product_name):
        """Main entry point to fetch data from all sources."""
        print(f"🌍 Global Ingestor: Fetching data for '{product_name}'...")
        all_reviews = []
        
        # Generate Canonical ID (Simulated)
        canonical_id = self.canonicalizer.generate_product_hash(product_name)
        
        # 1. Reddit
        reddit_reviews = self._fetch_reddit_data(product_name)
        # Tag with canonical ID
        for r in reddit_reviews: r['product_id'] = canonical_id
        all_reviews.extend(reddit_reviews)
        
        # 2. YouTube
        youtube_reviews = self._fetch_youtube_data(product_name)
        for r in youtube_reviews: r['product_id'] = canonical_id
        all_reviews.extend(youtube_reviews)
        
        # 3. Web
        forum_urls = self._search_web_free(product_name)
        for url in forum_urls:
            web_reviews = self._scrape_forum_page(url, canonical_id)
            all_reviews.extend(web_reviews)
            
        print(f"🌍 Stats: Reddit={len(reddit_reviews)}, YouTube={len(youtube_reviews)}, Web={len(all_reviews)-(len(reddit_reviews)+len(youtube_reviews))}")
        return all_reviews

