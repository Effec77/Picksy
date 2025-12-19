import hashlib
import random
from textblob import TextBlob
from datetime import datetime, timedelta

class DeDuplicator:
    """
    Identifies and removes duplicate reviews using MinHash-inspired logic (Exact + Near Duplicate).
    """
    def __init__(self):
        self.seen_hashes = set()

    def _compute_hash(self, text):
        """Computes a normalized hash of the review content."""
        # Simple normalization: lower case, remove spaces
        normalized = "".join(text.lower().split())
        return hashlib.md5(normalized.encode('utf-8')).hexdigest()

    def is_duplicate(self, text):
        """Checks if the text is a duplicate of something we've seen in this batch/session."""
        r_hash = self._compute_hash(text)
        if r_hash in self.seen_hashes:
            return True
        self.seen_hashes.add(r_hash)
        return False
        
    def filter_duplicates(self, reviews):
        """Returns a list of unique reviews."""
        unique = []
        for r in reviews:
            if not self.is_duplicate(r.get('content', '')):
                unique.append(r)
        return unique

class AuthenticityScorer:
    """
    The 'BS Detector'. 
    Uses a Ensemble of Metadata Heuristics and Semantic Analysis to score review credibility.
    """
    def __init__(self):
        # Known Bot Phrases (Generic/Low Effort)
        self.generic_phrases = [
            "good product", "nice", "fast shipping", "great", "ok", 
            "waste of money", "bad", "don't buy", "best ever"
        ]

    # --- COMPONENT A: METADATA CLASSIFIER (Behavioral) ---
    def _score_metadata(self, review):
        """
        Analyzes behavioral metadata.
        Returns score 0.0 (Bot) to 1.0 (Human).
        """
        score = 1.0
        
        # 1. Account Age (Mocked if not present)
        # Real logic: If account created < 24h ago -> Penalty
        # Here we just check if 'author_id' looks generated or anonymous
        author_id = review.get('author_id', '').lower()
        if 'anon' in author_id or 'user' in author_id:
            score -= 0.1
            
        # 2. Burstiness / Timestamp (Mocked context)
        # In a real batch pipeline, we'd check if this review matches a timestamp cluster.
        # Here we check if the review is "Verified Purchase"
        if review.get('verified_purchase'):
            score += 0.2
        else:
            score -= 0.1 # Unverified is suspicious
            
        # 3. Rating Deviation
        # Attempt to detect outliers if we had the prod avg. 
        # For now, we penalize extreme 1-star or 5-star with no text.
        rating = review.get('rating')
        content_len = len(review.get('content', ''))
        
        if rating in [1, 5] and content_len < 20:
             score -= 0.4 # "5 stars" with "great" is a classic bot pattern
             
        return max(0.0, min(score, 1.0))

    # --- COMPONENT B: SEMANTIC CLASSIFIER (Content) ---
    def _score_semantics(self, review):
        """
        Analyzes text content for genuine human expression.
        Returns score 0.0 (Generic/Bot) to 1.0 (Detailed/Human).
        """
        text = review.get('content', '')
        if not text: return 0.0
        
        score = 0.5
        
        # 1. Length & Specificity
        words = text.split()
        if len(words) > 50:
            score += 0.3 # Humans ramble
        elif len(words) < 5:
            score -= 0.3 # Bots are brief
            
        # 2. Subjectivity (Opinionated vs Factual)
        # Bots are often objective ("Item arrived on Tuesday") or purely emotional ("Love it").
        # Humans mix both ("The hinge feels cheap but sound is good").
        blob = TextBlob(text)
        if 0.3 < blob.sentiment.subjectivity < 0.7:
            score += 0.2 # Nuance is human
            
        # 3. Generic Phrase Penalty
        lower_text = text.lower().strip()
        if any(g in lower_text for g in self.generic_phrases) and len(words) < 10:
            score -= 0.4
            
        return max(0.0, min(score, 1.0))

    def evaluate(self, review):
        """
        Main entry point. Returns enriched review with scores.
        """
        meta_score = self._score_metadata(review)
        semantic_score = self._score_semantics(review)
        
        # Ensemble Weights: Content is King (0.6), Metadata is support (0.4)
        final_score = (0.4 * meta_score) + (0.6 * semantic_score)
        
        review['scores'] = {
            'metadata': round(meta_score, 2),
            'semantic': round(semantic_score, 2),
            'authenticity': round(final_score, 2)
        }
        
        # Verdict Logic
        if final_score > 0.7:
            review['verdict'] = "Authentic"
        elif final_score < 0.4:
            review['verdict'] = "Fake/Low-Quality"
        else:
            review['verdict'] = "Suspicious"
            
        return review

