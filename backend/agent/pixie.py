class PixieIntelligence:
    def __init__(self):
        self.name = "Pixie (Shopping Assistant)"

    def analyze_product(self, data):
        """
        Analyzes product data to generate a 'Listing Quality Score'.
        Honest assessment of the listing's reliability, not a guarantee of the product.
        """
        product_name = data.get('product_name', 'Unknown Product')
        reviews = data.get('reviews', [])
        
        # Scraped attributes
        rating = data.get('rating', 0) 
        review_count = data.get('review_count', len(reviews))
        seller = data.get('seller', 'Unknown')
        
        # --- Listing Quality Score Logic ---
        score = 0.5 # Base
        
        # 1. Social Proof (Volume)
        if review_count > 500:
            score += 0.15
        elif review_count > 50:
            score += 0.05
        elif review_count < 10:
            score -= 0.1
            
        # 2. Rating Health
        if rating > 4.2:
            score += 0.15
        elif rating < 3.5 and rating > 0:
            score -= 0.15
            
        # 3. Listing Depth (Description/Reviews)
        if reviews:
            avg_len = sum(len(r.get('content', '')) for r in reviews) / len(reviews)
            if avg_len > 150: # Detailed reviews imply engagement
                score += 0.1
            elif avg_len < 30: # Short/spammy reviews
                score -= 0.05
                
        # 4. Seller Reliability
        trusted_sellers = ['Appario', 'Cloudtail', 'Amazon', 'Flipkart', 'Official', 'Nike', 'Adidas', 'Puma']
        if any(ts.lower() in seller.lower() for ts in trusted_sellers):
            score += 0.1
            
        # Cap Score
        score = min(max(score, 0.1), 0.99)
        
        # Enrich reviews if present
        analyzed_reviews_list = []
        if reviews:
            analyzed_reviews_list = self.enrich_reviews(reviews)

        return {
            "product_name": product_name,
            "trust_score": round(score, 2), # Frontend expects 'trust_score', keeping key for compatibility
            "quality_label": self._get_quality_label(score),
            "analyzed_reviews": analyzed_reviews_list[:5] 
        }
        
    def _get_quality_label(self, score):
        if score > 0.8: return "High Quality Listing"
        if score > 0.6: return "Average Listing"
        return "Low Information Listing"

    def enrich_reviews(self, reviews):
        """
        Adds 'sentiment' and 'verdict' using improved heuristics.
        """
        enriched = []
        
        # Expanded Lexicon
        pos_words = set(['good', 'great', 'love', 'excellent', 'best', 'perfect', 'amazing', 'happy', 'worth', 'nice', 'sturdy', 'premium', 'fast', 'reliable'])
        neg_words = set(['bad', 'worst', 'hate', 'terrible', 'awful', 'broken', 'useless', 'issue', 'problem', 'poor', 'slow', 'cheap', 'defective', 'fake'])
        
        for r in reviews:
            content = r.get('content', '').lower()
            if not content:
                continue
                
            words = content.split()
            pos_count = sum(1 for w in words if w in pos_words)
            neg_count = sum(1 for w in words if w in neg_words)
            total = pos_count + neg_count
            
            sentiment = 0.0
            if total > 0:
                sentiment = (pos_count - neg_count) / total
            
            # Simple Verdict
            verdict = "Neutral"
            if sentiment > 0.3: verdict = "Positive"
            if sentiment < -0.3: verdict = "Negative"
            
            if len(content) < 20:
                verdict = "Short/Unhelpful"

            r['sentiment'] = sentiment
            r['verdict'] = verdict
            r['pixie_score'] = round(0.5 + (sentiment * 0.5), 2)
            
            enriched.append(r)
            
        return enriched
