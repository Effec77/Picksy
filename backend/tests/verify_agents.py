import sys
import os
import json
import shutil

# Setup paths
# Setup paths
# We are in /backend/tests/verify_agents.py
# We want to add / (Project Root) to path so we can do 'from backend.agent...'
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(project_root)

from backend.agent.orchestrator import ReviewIntelligence
from backend.agent.reporter import BusinessReporter
from backend.agent.scorer import AuthenticityScorer, DeDuplicator

def test_pipeline():
    print("🧪 Starting Agent 2 & 3 Verification Pipeline...")

    # 1. Setup Mock Reviews
    # Mix of Real, Spam, and Duplicate
    reviews = [
        # Authentics
        {"id": "1", "content": "The noise cancellation is top notch, but the earcups get hot after 2 hours. Battery is solid.", "product_id": "sony_xm5", "verified_purchase": True, "author_id": "real_user_1", "rating": 4},
        {"id": "2", "content": "Amazing sound quality. The bass is punchy without muddying the mids. Best headphones I've owned.", "product_id": "sony_xm5", "verified_purchase": True, "author_id": "real_user_2", "rating": 5},
        # Spam/Bot
        {"id": "3", "content": "Best product ever fast shipping", "product_id": "sony_xm5", "verified_purchase": False, "author_id": "bot_1", "rating": 5}, # Short/Generic
        {"id": "4", "content": "Best product ever fast shipping", "product_id": "sony_xm5", "verified_purchase": False, "author_id": "bot_2", "rating": 5}, # Duplicate
        {"id": "5", "content": "Wow", "product_id": "sony_xm5", "verified_purchase": False, "author_id": "lazy_1", "rating": 5}, # Too short
    ]

    # 2. Test Scorer & Deduplication (Agent 2)
    print("\n--- Testing Agent 2 (The BS Detector) ---")
    agent2 = ReviewIntelligence()
    
    # We use agent2.index_reviews which runs the full pipeline
    processed_reviews = agent2.index_reviews(reviews)
    
    # Validation logic
    accepted_ids = [r['id'] for r in processed_reviews]
    print(f"Processed IDs: {accepted_ids}")
    
    if "1" in accepted_ids and "2" in accepted_ids:
        print("✅ Real reviews accepted.")
    else:
        print("❌ Real reviews were rejected!")
        
    if "4" in accepted_ids:
        print("❌ Duplicate review '4' was NOT filtered!")
    else:
        print("✅ Duplicate review filtered.")

    if "3" in accepted_ids: 
        # ID 3 might be filtered by metadata or semantic score. 
        # "Best product ever fast shipping" -> likely score < 0.4
        print(f"⚠️ Review 3 'Generic' verdict: {next(r['verdict'] for r in processed_reviews if r['id'] == '3')}")
    else:
        print("✅ Low-effort bot review filtered.")

    # 3. Test Aspect Analysis (Agent 3) (Mocking DBSCAN result if needed, but running real)
    print("\n--- Testing Agent 3 (The Consultant) ---")
    # We need to give time for embeddings? No, local chroma is sync usually.
    
    aspects = agent2.perform_aspect_analysis("sony_xm5")
    print(f"Found {len(aspects)} aspects.")
    for a in aspects:
        print(f"   - Cluster {a['cluster_id']} ({a['size']} items): {a['sample_text'][:50]}...")

    # 4. Test Reporter (Excel)
    print("\n--- Testing Output Generation ---")
    reporter = BusinessReporter("Sony XM5 Test")
    
    # Verify Excel Creation
    filename = reporter.generate_excel(processed_reviews, aspects)
    if os.path.exists(filename):
        print(f"✅ Excel Report Generated: {filename}")
        # Clean up
        try:
            os.remove(filename)
            print("   (Cleaned up test file)")
        except:
            pass
    else:
        print("❌ Excel Report Failed to Generate")

if __name__ == "__main__":
    try:
        test_pipeline()
    except Exception as e:
        print(f"❌ Test Failed with Error: {e}")
