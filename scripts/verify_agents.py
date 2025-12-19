import sys
import os
import json
import pytest

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))

from app import app
from agent.orchestrator import ReviewIntelligence

def test_agent_initialization():
    print("\n--- Testing Agent 3 Initialization ---")
    try:
        agent = ReviewIntelligence()
        print("✅ ReviewIntelligence initialized successfully.")
        return agent
    except Exception as e:
        print(f"❌ Failed to initialize ReviewIntelligence: {e}")
        return None

def test_agent_insights(agent):
    print("\n--- Testing Agent 3 Insights (ChromaDB) ---")
    if not agent:
        print("Skipping: Agent not initialized.")
        return

    # 1. Index some dummy reviews
    dummy_reviews = [
        {"id": "1", "content": "The battery life is amazing, lasts 2 days.", "product_id": "test_phone"},
        {"id": "2", "content": "Camera performs poorly in low light.", "product_id": "test_phone"},
        {"id": "3", "content": "Great value for money.", "product_id": "test_phone"}
    ]
    print(f"Indexing {len(dummy_reviews)} dummy reviews...")
    try:
        agent.index_reviews(dummy_reviews)
        print("✅ Indexing successful.")
    except Exception as e:
        print(f"❌ Indexing failed: {e}")

    # 2. Query
    query = "battery"
    print(f"Querying for '{query}'...")
    try:
        results = agent.get_business_insights(query=query, n_results=1)
        print(f"Results: {results}")
        if results and "battery" in results[0].lower():
             print("✅ Semantic search working: Found relevant review.")
        else:
             print("⚠️ Semantic search returned unexpected results (might be empty if model downloading).")
    except Exception as e:
        print(f"❌ Query failed: {e}")

def test_api_endpoints():
    print("\n--- Testing Flask API Endpoints ---")
    client = app.test_client()

    # 1. /health
    resp = client.get('/health')
    print(f"/health status: {resp.status_code}")
    data = resp.json
    if resp.status_code == 200 and data.get('status') == 'ok' and data.get('agents', {}).get('review') == 'active':
        print("✅ /health check passed.")
    else:
        print(f"❌ /health check failed: {data}")

    # 2. /reviews/summary
    payload = {
        "product": {"title": "Test Product"},
        "user_email": "test@business.com",
        "is_business": True
    }
    resp = client.post('/reviews/summary', json=payload)
    print(f"/reviews/summary status: {resp.status_code}")
    if resp.status_code == 200 and "Business Insight" in resp.json['summary']:
        print("✅ Business Summary returned successfully.")
    else:
        print("❌ Summary endpoint failed or missing business insight.")

    # 3. /reviews/chat
    chat_payload = {
        "query": "battery",
        "product_title": "Test Product",
        "user_email": "test@business.com",
        "is_business": True
    }
    resp = client.post('/reviews/chat', json=chat_payload)
    print(f"/reviews/chat status: {resp.status_code}")
    if resp.status_code == 200 and "Business Action" in resp.json['answer']:
        print("✅ Business Chat returned successfully.")
    else:
        print("❌ Chat endpoint failed.")

if __name__ == "__main__":
    agent = test_agent_initialization()
    test_agent_insights(agent)
    test_api_endpoints()
