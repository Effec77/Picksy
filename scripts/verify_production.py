import sys
import os
import json

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.config import AppConfig
from backend.agent.pixie import PixieIntelligence
from backend.agent.banking import BankingStrategyAgent
from backend.agent.reporter import BusinessReporter

def test_config():
    print("\n--- 1. Testing Configuration ---")
    print(f"DB Path: {AppConfig.CHROMA_DB_PATH}")
    if os.path.basename(AppConfig.CHROMA_DB_PATH) == 'chroma_db':
        print("✅ Config Loaded & Path is Relative")
    else:
        print("❌ Config Path Error")

def test_pixie_enrichment():
    print("\n--- 2. Testing Pixie Intelligence ---")
    pixie = PixieIntelligence()
    reviews = [
        {"content": "This product is amazing and I love it! Best purchase ever."},
        {"content": "Terrible. I hate it. Worst waste of money."},
        {"content": "It is okay."}
    ]
    enriched = pixie.enrich_reviews(reviews)
    
    # Check Sentiment
    pos = enriched[0]['sentiment']
    neg = enriched[1]['sentiment']
    print(f"Positive Review Sentiment: {pos}")
    print(f"Negative Review Sentiment: {neg}")
    
    if pos > 0 and neg < 0:
        print("✅ Sentiment Logic Working")
    else:
        print("❌ Sentiment Logic Failed")

    # Check Verdict
    if 'verdict' in enriched[0]:
         print("✅ Verdict Field Present")
    else:
         print("❌ Verdict Field Missing")

def test_banking_logic():
    print("\n--- 3. Testing Banking Logic (Budget Impact) ---")
    agent = BankingStrategyAgent()
    
    # Test Transaction Impact
    print("Testing 'Flight to Paris' (₹50,000)...")
    res = agent.evaluate_transaction_impact("Flight to Paris", 50000)
    
    # Verify Structure
    if 'impact_level' in res and 'best_payment_method' in res:
        print(f"✅ Impact Analysis: {res['impact_level']} ({res['impact_color']})")
        print(f"   Message: {res['impact_message']}")
        print(f"   Recommendation: {res['best_payment_method']['name']}")
    else:
        print(f"❌ Response Structure Invalid: {res}")

    # Test Rewards Optimization (Internal check)
    print("\nTesting Card Optimization logic...")
    # This is implicitly tested via best_payment_method, but we can check if it varies
    res_dining = agent.evaluate_transaction_impact("Dinner at Taj", 5000)
    print(f"✅ Dining Recommendation: {res_dining['best_payment_method']['name']}")

def test_reporter():
    print("\n--- 4. Testing Business Reporter ---")
    # Clean up old reports
    import glob
    for f in glob.glob("Picksy_Business_Audit_*.xlsx"):
        os.remove(f)

    reporter = BusinessReporter("Test Product")
    reviews = [
        {"content": "Great product", "sentiment": 0.8, "verdict": "Authentic", "pixie_score": 0.9},
        {"content": "Bad product", "sentiment": -0.8, "verdict": "Authentic", "pixie_score": 0.1}
    ]
    try:
        filename = reporter.generate_excel(reviews)
        if os.path.exists(filename):
            print(f"✅ Report Generated: {filename}")
            # Clean up
            os.remove(filename)
        else:
            print("❌ File was not created")
    except Exception as e:
        print(f"❌ Report Generation Failed: {e}")

if __name__ == "__main__":
    test_config()
    test_pixie_enrichment()
    test_banking_logic()
    test_reporter()
