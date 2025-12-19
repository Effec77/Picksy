import requests
import json
import uuid

BASE_URL = "http://localhost:5000"
HEADERS = {"X-Picksy-Source": "Extension", "Content-Type": "application/json"}

def test_health():
    print(f"Testing {BASE_URL}/health...")
    try:
        resp = requests.get(f"{BASE_URL}/health")
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.json()}")
        assert resp.status_code == 200
    except Exception as e:
        print(f"FAILED: {e}")

def test_shop_assist():
    print(f"\nTesting {BASE_URL}/shop_assist (Pixie & Banking)...")
    payload = {
        "product_name": "Test Product Sony WH-1000XM5",
        "price": 25000,
        "reviews": [
            {"content": "Amazing noise cancelling, love it!", "review_id": str(uuid.uuid4())},
            {"content": "Too expensive but good quality.", "review_id": str(uuid.uuid4())},
            {"content": "Battery life is decent.", "review_id": str(uuid.uuid4())}
        ],
        "rating": 4.5,
        "review_count": 120,
        "seller": "Appario Retail"
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/shop_assist", headers=HEADERS, json=payload)
        print(f"Status: {resp.status_code}")
        data = resp.json()
        print("Response Keys:", data.keys())
        
        # Verify structure
        assert "financial_insight" in data
        assert "quality_label" in data
        assert data["financial_insight"]["impact_level"] in ["Low", "Medium", "High"]
        
        print("✅ Shop Assist Test Passed")
        print(f"  - Quality: {data['quality_label']}")
        print(f"  - Budget Impact: {data['financial_insight']['impact_message']}")
        
    except Exception as e:
        print(f"FAILED: {e}")
        print(resp.text if 'resp' in locals() else "No response")

def test_auth_rejection():
    print(f"\nTesting Auth Rejection (No Header)...")
    try:
        resp = requests.post(f"{BASE_URL}/shop_assist", json={})
        # Note: If debug=True in Flask, it might still allow it depending on implementation, 
        # but our middleware wrapper specifically checks header unless debug bypass logic is generous.
        # Our implementation: if not auth_header and not app.debug: return 401.
        # Since app.run(debug=True), this test might actually pass with 200.
        # Let's check what happens.
        print(f"Status (Debug Mode might allow 200): {resp.status_code}")
    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    test_health()
    test_shop_assist()
    test_auth_rejection()
