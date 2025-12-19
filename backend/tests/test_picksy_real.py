import unittest
import sys
import os
import shutil

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent.scorer import AuthenticityScorer
from agent.orchestrator import ReviewIntelligence

class TestPicksyReal(unittest.TestCase):
    def setUp(self):
        self.scorer = AuthenticityScorer()
        # Clean up old test db if exists
        if os.path.exists("test_chroma_db"):
             try:
                shutil.rmtree("test_chroma_db")
             except:
                pass
        
    def test_duplicate_detection(self):
        print("\nTesting Duplicate Detection...")
        reviews = [
            {"id": "1", "content": "This is a great product I love it."},
            {"id": "2", "content": "This is a great product I love it."} # Exact duplicate
        ]
        
        # First one might be okay if we check others, but our logic checks duplicates in list
        score1 = self.scorer.calculate_metadata_score(reviews, reviews[0])
        score2 = self.scorer.calculate_metadata_score(reviews, reviews[1])
        
        print(f"Score 1: {score1}, Score 2: {score2}")
        self.assertEqual(score1, 0.0, "Duplicate should get 0.0 score")
        self.assertEqual(score2, 0.0, "Duplicate should get 0.0 score")

    def test_sentiment_analysis(self):
        print("\nTesting Sentiment Analysis...")
        text_good = "I absolutely love this amazing product!"
        text_bad = "This is the worst garbage I have ever bought."
        
        sentiment_good = self.scorer.calculate_sentiment_score(text_good)
        sentiment_bad = self.scorer.calculate_sentiment_score(text_bad)
        
        print(f"Good Sentiment: {sentiment_good}")
        print(f"Bad Sentiment: {sentiment_bad}")
        
        self.assertTrue(sentiment_good > 0.3)
        self.assertTrue(sentiment_bad < -0.3)

    def test_orchestrator(self):
        print("\nTesting Review Intelligence Orchestrator...")
        # Override db path for testing
        orchestrator = ReviewIntelligence()
        # Hack to use test db path if possible, but for MVP we might just use default and ignore
        # Or better, logic in orchestrator should allow path override.
        # But 'orchestrator.py' has hardcoded path for now. 
        # For this test, we accept it writes to the main DB (it's persistent mode).
        
        reviews = [
            {"id": "101", "content": "The battery life is terrible, dies in one hour.", "product_id": "p1"},
            {"id": "102", "content": "The screen is beautiful and bright.", "product_id": "p1"}
        ]
        
        orchestrator.index_reviews(reviews)
        
        # Query
        results = orchestrator.get_business_insights("power issue")
        print(f"Search Results for 'power issue': {results}")
        
        self.assertTrue(any("battery" in doc for doc in results))

if __name__ == '__main__':
    unittest.main()
