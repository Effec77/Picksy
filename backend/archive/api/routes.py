from flask import Flask, request, jsonify, send_file
# Remove local Flask import as we use app from backend/app.py
# from flask_cors import CORS # Handled in app.py
import sys
import os

# Add parent directory to path to allow importing agent modules
# This allows running 'python backend/api/routes.py' directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent.scorer import AuthenticityScorer
from agent.orchestrator import ReviewIntelligence
from agent.reporter import BusinessReporter
from agent.ingestor import GlobalIngestor
from agent.banking import BankingStrategyAgent

# Import core app and db from 'app' module (backend/app.py)
# Since we added parent dir to path, we can import from 'app'
from app import app, db
from models.models import Review, User

# Initialize Intelligence Orchestrator (loads ChromaDB)
# We initialize it globally to keep the DB connection alive
try:
    intelligence = ReviewIntelligence()
    print("✅ ChromaDB Intelligence Layer Loaded")
except Exception as e:
    print(f"⚠️ Warning: ChromaDB failed to load: {e}")
    intelligence = None

@app.route('/analyze', methods=['POST'])
def analyze_reviews():
    try:
        reviews = request.json
        if not reviews or not isinstance(reviews, list):
            return jsonify({"error": "Invalid input, expected list of reviews"}), 400
        
        scorer = AuthenticityScorer()
        analyzed_reviews = []
        
        for review in reviews:
            meta_score = scorer.calculate_metadata_score(reviews, review)
            sentiment = scorer.calculate_sentiment_score(review.get('content', ''))
            verdict, score = scorer.get_final_verdict(meta_score, sentiment)
            
            review['picksy_score'] = score
            review['sentiment'] = sentiment
            review['verdict'] = verdict
            analyzed_reviews.append(review)
            
            # Index review if intelligence layer is active
            if intelligence:
                # We wrap it in a list as the method expects a list? 
                # Actually index_reviews expects a list
                pass
                
        if intelligence:
             intelligence.index_reviews(analyzed_reviews)

        return jsonify(analyzed_reviews)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/report', methods=['POST'])
def generate_report():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "Invalid input"}), 400
            
        product_name = data.get('product_name', 'Unknown_Product')
        reviews_data = data.get('reviews', [])
        
        reporter = BusinessReporter(product_name)
        file_path = reporter.generate_excel(reviews_data)
        
        return send_file(file_path, as_attachment=True, download_name=file_path)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.json
        username = data.get('username')
        if not username:
             return jsonify({"error": "Username required"}), 400
             
        # Simple Logic: Get or Create
        user = User.query.filter_by(username=username).first()
        if not user:
            user = User(username=username)
            db.session.add(user)
            db.session.commit()
            print(f"👤 Created new user: {username}")
        # Login
        print(f"Testing Login...")
        login_payload = {"username": "test_user_picksy"}
        # The 'try:' below is incomplete and would cause a SyntaxError.
        # As per instructions to ensure syntactical correctness,
        # this 'try:' is commented out or removed if it's not part of a complete block.
        # Assuming it was meant to be a test snippet, it's placed here.
        # try: 
        
        return jsonify({"user_id": user.id, "username": user.username})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/shop_assist', methods=['POST'])
def shop_assist():
    try:
        data = request.json
        reviews = data.get('reviews', [])
        product_name = data.get('product_name', 'Unknown Product')
        price = data.get('price', 0)
        user_id = data.get('user_id') # New Field
        
        # 1. Ingestion Engine (Tier 2/3/4)
        ingestor = GlobalIngestor()
        external_reviews = ingestor.fetch_supplementary_data(product_name)
        all_reviews = reviews + external_reviews
        
        # 2. Analysis Engine (Agent 2 & 3)
        scorer = AuthenticityScorer()
        analyzed_reviews = []
        authentic_count = 0
        total_score = 0
        
        for review in all_reviews:
            meta_score = scorer.calculate_metadata_score(all_reviews, review)
            sentiment = scorer.calculate_sentiment_score(review.get('content', ''))
            verdict, score = scorer.get_final_verdict(meta_score, sentiment)
            
            review['picksy_score'] = score
            review['sentiment'] = sentiment
            review['verdict'] = verdict
            analyzed_reviews.append(review)
            
            if verdict == 'Authentic':
                authentic_count += 1
                
        # Calculate overall Trust Score
        trust_score = authentic_count / len(analyzed_reviews) if analyzed_reviews else 0
        
        # Index data if intelligence is active
        if intelligence:
            intelligence.index_reviews(analyzed_reviews)

        # --- PERSISTENCE LAYER ---
        # Save results to SQLite linked to User
        try:
            with app.app_context():
                for r in analyzed_reviews:
                    new_review = Review(
                        user_id=user_id, # Link to User
                        product_name=product_name,
                        product_id_scraped=r.get('id', 'N/A'), 
                        review_content=r.get('content', ''),
                        review_source=r.get('source', 'unknown'),
                        picksy_score=r.get('picksy_score', 0.0),
                        sentiment_score=r.get('sentiment', 0.0),
                        verdict=r.get('verdict', 'Unscored')
                    )
                    db.session.add(new_review)
                db.session.commit()
                print(f"💾 Saved {len(analyzed_reviews)} reviews to history for User {user_id}.")
        except Exception as db_e:
            print(f"❌ Database save failed: {db_e}")
            
        # 3. Banking Agent (Agent 4)
        banking_agent = BankingStrategyAgent()
        
        # fetch user history context (Risk Profile)
        history_risk_count = 0
        try:
             with app.app_context():
                 # Filter by User ID if provided
                 query = Review.query.filter(
                     (Review.verdict == 'Fake') | (Review.verdict == 'Suspicious')
                 )
                 if user_id:
                     query = query.filter_by(user_id=user_id)
                     
                 history_risk_count = query.count()
        except Exception:
            history_risk_count = 0

        user_history = {'negative_reviews': history_risk_count}
        
        financial_nudge = banking_agent.evaluate_transaction(product_name, price, trust_score, user_history)
        
        return jsonify({
            "product_name": product_name,
            "trust_score": trust_score,
            "analyzed_reviews": analyzed_reviews,
            "financial_nudge": financial_nudge
        })

    except Exception as e:
        print(f"Error in shop_assist: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting Picksy Backend API...")
    # Initialize DB tables
    with app.app_context():
        db.create_all()
        print("🗄️ Database tables created/verified.")
        
    app.run(debug=True, port=5000)