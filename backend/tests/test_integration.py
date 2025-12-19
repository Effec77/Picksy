import requests
import json

def test_shop_assist():
    base_url = "http://localhost:5000"
    
    # 1. Login
    print(f"Testing Login...")
    login_payload = {"username": "test_user_picksy"}
    try:
        login_resp = requests.post(f"{base_url}/login", json=login_payload)
        login_resp.raise_for_status()
        user_data = login_resp.json()
        user_id = user_data['user_id']
        print(f"✅ Logged in as User ID: {user_id}")
    except Exception as e:
        print(f"❌ Login Failed: {e}")
        return

    # 2. Shop Assist
    url = f"{base_url}/shop_assist"
    
    payload = {
        "user_id": user_id,
        "product_name": "Sony WH-1000XM5 Wireless Headphones",
        "price": 348.00,
        "reviews": [
            {"content": "These are amazing! Noise cancellation is top tier.", "source": "Amazon"},
            {"content": "Battery life is good but the hinge feels fragile.", "source": "Amazon"},
            {"content": "Fake review, do not buy!", "source": "Amazon"}
        ]
    }
    
    print(f"Testing {url} with user_id={user_id}...")
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        
        data = response.json()
        print("\n✅ Success! Response received:")
        # print(json.dumps(data, indent=2)) 
        
        # Verify structure
        assert "trust_score" in data, "Missing trust_score"
        assert "financial_nudge" in data, "Missing financial_nudge"
        assert "analyzed_reviews" in data, "Missing analyzed_reviews"
        
        nudge = data["financial_nudge"]
        print(f"\n💡 Nudge: {nudge['action']} - {nudge['recommended_card']}")
        print(f"💰 Reward: {nudge['estimated_reward']}")
        
    except Exception as e:
        print(f"\n❌ Test Failed: {e}")
        if 'response' in locals():
            print(f"Response Body: {response.text}")

if __name__ == "__main__":
    test_shop_assist()
