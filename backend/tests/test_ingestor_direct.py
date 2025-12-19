import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent.ingestor import GlobalIngestor

def test_ingestion():
    print("🧪 Testing Global Ingestor (Direct)...")
    ingestor = GlobalIngestor()
    
    product_name = "Sony WH-1000XM5"
    print(f"🔎 Fetching data for: {product_name}")
    
    results = ingestor.fetch_supplementary_data(product_name)
    
    print(f"\n✅ Total Items Found: {len(results)}")
    
    print("\n--- Source Breakdown ---")
    sources = {}
    for r in results:
        src = r['source']
        sources[src] = sources.get(src, 0) + 1
        
    for src, count in sources.items():
        print(f"• {src}: {count} items")
        
    print("\n--- Sample Content (Tier 4) ---")
    tier_4_samples = [r for r in results if "Web" in r['source']]
    if tier_4_samples:
        for s in tier_4_samples[:2]:
            print(f"[{s['source']}] {s['content'][:100]}...")
    else:
        print("❌ No Tier 4 items found!")

if __name__ == "__main__":
    test_ingestion()
