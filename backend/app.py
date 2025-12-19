from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
import os
import sys
import threading
import uuid
from functools import wraps

# Ensure backend directory and project root are in path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent.orchestrator import ReviewIntelligence
from agent.pixie import PixieIntelligence
from agent.banking import BankingStrategyAgent
from agent.recommendation import RecommendationAgent
from agent.misc import MiscAgent
from agent.reporter import BusinessReporter
from backend.config import AppConfig

app = Flask(__name__)
# Restrict CORS to extension ID in production, allowing all for dev
CORS(app, resources={r"/*": {"origins": "*"}}) 

# Initialize Agents
review_agent = ReviewIntelligence()
pixie_agent = PixieIntelligence()
banking_agent = BankingStrategyAgent() # Universal Mode
rec_agent = RecommendationAgent()
misc_agent = MiscAgent()

print("✅ All Agents Initialized: Pixie, Banking, Review, Recs, Misc")

# --- Security Middleware (DISABLED) ---
def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Universal Access: No authentication required.
        return f(*args, **kwargs)
    return decorated

# --- Async Worker ---
def background_indexer(reviews, product_name):
    """Indices reviews in the background to not block UI"""
    try:
        print(f"🔄 [Async] Indexing {len(reviews)} reviews for '{product_name}'...")
        # Add metadata
        for r in reviews:
            r['product_id'] = product_name
            if 'id' not in r and 'review_id' not in r:
                r['id'] = str(uuid.uuid4())
        
        review_agent.index_reviews(reviews)
        print(f"✅ [Async] Indexing complete for '{product_name}'")
    except Exception as e:
        print(f"❌ [Async] Indexing failed: {e}")

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok", 
        "version": "1.0.0-market-ready",
        "agents": {
            "pixie": "active",
            "banking": "active",
            "review": "active"
        }
    })

# Login endpoint removed for universal access

# --- Agent 1 & 2: Pixie (Product) + Banking (Finance) ---
@app.route('/shop_assist', methods=['POST'])
@require_auth
def shop_assist():
    data = request.json
    try:
        # 1. ASYNC INDEXING: Fire and forget
        reviews = data.get('reviews', [])
        product_name = data.get('product_name') or data.get('title') or 'Unknown'
        
        if reviews:
            # We will run this in the pool below to synchronize it
            pass

        # 2. Parallel Execution for Pixie (Product), Banking (Finance) & Indexing
        from concurrent.futures import ThreadPoolExecutor
        
        price = data.get('price', 0)
        
        with ThreadPoolExecutor(max_workers=3) as executor:
            # Launch Tasks
            future_pixie = executor.submit(pixie_agent.analyze_product, data)
            future_banking = executor.submit(banking_agent.evaluate_transaction_impact, product_name, price)
            
            future_indexing = None
            if reviews:
                future_indexing = executor.submit(background_indexer, reviews, product_name)
            
            # Gather Results (Wait for all to ensure Indexing is done before Summary call)
            pixie_result = future_pixie.result()
            banking_result = future_banking.result()
            
            if future_indexing:
                future_indexing.result() # Wait for indexing to complete
        
        response = {
            **pixie_result,
            "financial_insight": banking_result 
        }
        
        return jsonify(response)
    except Exception as e:
        print(f"Error in shop_assist: {e}")
        return jsonify({"error": str(e)}), 500

# --- Agent 3: Review Intelligence ---
@app.route('/reviews/summary', methods=['POST'])
@require_auth
def review_summary():
    data = request.json
    product = data.get('product', {})
    
    title = product.get('title', 'Product')
    product_id = title
    
    # LIVE SUMMARY GENERATION with Filtering
    general = review_agent.get_business_insights(query=f"overall opinion of {title}", product_id=product_id, n_results=5)
    pros = review_agent.get_business_insights(query=f"best features of {title}", product_id=product_id, n_results=5)
    cons = review_agent.get_business_insights(query=f"problems with {title}", product_id=product_id, n_results=5)
    
    # STRICT BACKEND KEY USAGE
    valid_key = AppConfig.GEMINI_API_KEY
    
    # Synthesize with Gemini if Key is available
    if valid_key and (general or pros or cons):
        snippets = list(set(general + pros + cons))
        summary_text = review_agent.generate_perception_summary(
            snippets=snippets,
            product_name=title,
            api_key=valid_key
        )
        import markdown
        summary_text = markdown.markdown(summary_text)
    else:
        # Fallback to snippets
        if not general and not pros and not cons:
             summary_text = f"We haven't indexed enough reviews for <strong>{title}</strong> yet. Give us a moment!"
        else:
            summary_text = f"<strong>Quick Analysis for {title[:20]}...</strong><br><br>"
            if pros:
                summary_text += "<span style='color:#2ecc71'>✅ <strong>Highlights:</strong></span><br>" + "<br>".join([f"• \"{p[:80]}...\"" for p in pros[:3]]) + "<br><br>"
            if cons:
                summary_text += "<span style='color:#e74c3c'>⚠️ <strong>Complaints:</strong></span><br>" + "<br>".join([f"• \"{c[:80]}...\"" for c in cons[:3]])
            
            if not valid_key:
                summary_text += "<br><br><em>(Server Config Error: Missing GEMINI_API_KEY in backend)</em>"
    
    return jsonify({"summary": summary_text})

@app.route('/reviews/chat', methods=['POST'])
@require_auth
def review_chat():
    data = request.json
    query = data.get('query')
    product_title = data.get('product_title', 'unknown')
    
    insights = review_agent.get_business_insights(query=query, product_id=product_title, n_results=5)
    
    # STRICT BACKEND KEY USAGE
    valid_key = AppConfig.GEMINI_API_KEY
    
    if not insights:
        answer = f"I searched the reviews for '{product_title}' but couldn't find matches for '{query}'."
    else:
        if valid_key:
             answer = review_agent.synthesize_answer(query, insights, product_title, valid_key)
             answer = answer.replace('\n', '<br>')
        else:
            snippets = "<br>".join([f"🗣️ \"{s[:120]}...\"" for s in insights[:3]])
            answer = f"Based on matched reviews:<br><br>{snippets}<br><br><em>(Server Config Error: Missing Backend API Key)</em>"

    return jsonify({"answer": answer})

# ---------------- MISC AGENT ----------------
@app.route('/misc/history', methods=['POST'])
@require_auth
def misc_history():
    data = request.json
    price = data.get('price', 0)
    title = data.get('title', '')
    history = misc_agent.get_price_history(price, title)
    return jsonify(history)

@app.route('/misc/alert', methods=['POST'])
@require_auth
def misc_alert():
    data = request.json
    return jsonify(misc_agent.set_price_alert(data.get('url'), data.get('target'), data.get('email')))

@app.route('/misc/coupons', methods=['POST'])
@require_auth
def misc_coupons():
    domain = request.json.get('domain', '')
    return jsonify({"coupons": misc_agent.get_coupons(domain)})

# --- Agent 4: Recommendation Agent ---
@app.route('/recommendations', methods=['POST'])
@require_auth
def get_recommendations():
    data = request.json
    history = data.get('history', [])
    recs = rec_agent.get_recommendations(history)
    return jsonify({"recommendations": recs})

@app.route('/report', methods=['POST'])
@require_auth
def generate_report():
    data = request.json
    product_name = data.get('product_name') or 'Unknown Product'
    reviews = data.get('reviews', [])
    
    print(f"📊 Generating Business Audit for: {product_name}...")
    
    # 1. Process Reviews through Agent 2 (The Truth Filter)
    # This cleans, scores, and indexes them.
    valid_reviews = review_agent.index_reviews(reviews)
    
    # 2. Agent 3: Aspect-Based Analysis (The "Consultant")
    # Gets deep insights from the vectors we just indexed
    aspects = review_agent.perform_aspect_analysis(product_name)
    
    # 3. Generate Excel
    reporter = BusinessReporter(product_name)
    # Pass both the granular ledger (valid_reviews) and the high-level insights (aspects)
    filename = reporter.generate_excel(valid_reviews, aspects)
    
    return jsonify({
        "status": "success", 
        "message": f"Global Audit Report Generated: {filename}",
        "download_url": f"/download/{filename}"
    })

if __name__ == '__main__':
    print("🚀 Starting Market-Ready Backend on Port 5000...")
    app.run(debug=True, use_reloader=False, port=5000)
