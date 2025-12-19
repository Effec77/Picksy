import chromadb
from backend.config import AppConfig
from groq import Groq
from backend.agent.scorer import AuthenticityScorer, DeDuplicator
from sklearn.cluster import DBSCAN
import numpy as np
import collections

class ReviewIntelligence:
    def __init__(self):
        # Local vector DB
        db_path = AppConfig.CHROMA_DB_PATH
        self.client = chromadb.PersistentClient(path=db_path)
        self.collection = self.client.get_or_create_collection(name="reviews")
        
        # Tools
        self.scorer = AuthenticityScorer()
        self.deduplicator = DeDuplicator()

    def index_reviews(self, reviews):
        """
        Ingests, Cleans, Scores, and Indexes reviews.
        """
        print(f"🧠 Orchestrator: Processing {len(reviews)} raw reviews...")
        
        # 1. Deduplication
        unique_reviews = self.deduplicator.filter_duplicates(reviews)
        print(f"   - Removed {len(reviews) - len(unique_reviews)} duplicates.")
        
        # 2. Authenticity Scoring & Filtering
        valid_reviews = []
        ids = []
        documents = []
        metadatas = []
        
        for r in unique_reviews:
            # Score it
            analyzed = self.scorer.evaluate(r)
            
            # Filter low quality (The "Truth Filter")
            if analyzed.get('verdict') == "Fake/Low-Quality":
                continue
                
            # Prepare for DB
            r_id = str(analyzed.get('review_id') or analyzed.get('id', ''))
            valid_reviews.append(analyzed)
            ids.append(r_id)
            documents.append(analyzed.get('content', ''))
            
            # Store Metadata
            meta = {
                'product_id': str(analyzed.get('product_id', 'unknown')),
                'authenticity_score': analyzed['scores']['authenticity'],
                'verdict': analyzed.get('verdict', 'Suspicious'),
                'source': analyzed.get('source_platform', 'unknown')
            }
            metadatas.append(meta)

        if ids:
            print(f"   - Indexing {len(ids)} valid reviews into ChromaDB.")
            self.collection.upsert(
                documents=documents,
                ids=ids,
                metadatas=metadatas
            )
        else:
            print("   - No valid reviews to index after filtration.")
            
        return valid_reviews

    def get_business_insights(self, query="battery issues", product_id=None, n_results=5):
        """Semantic Search Wrapper."""
        try:
            where_clause = {}
            if product_id: where_clause = {"product_id": str(product_id)}

            results = self.collection.query(
                query_texts=[query],
                n_results=n_results,
                where=where_clause
            )
            if results and results['documents']:
                return results['documents'][0]
            return []
        except Exception as e:
            print(f"Error querying ChromaDB: {e}")
            return []

    def perform_aspect_analysis(self, product_id):
        """
        ASPECT-BASED SENTIMENT ANALYSIS (ABSA)
        1. Fetch embeddings for product.
        2. Cluster using DBSCAN.
        3. Identify themes (Clusters).
        """
        try:
            # Fetch all embeddings for this product
            record = self.collection.get(
                where={"product_id": str(product_id)},
                include=['embeddings', 'documents', 'metadatas']
            )
            
            if not record['embeddings']:
                return []

            embeddings = np.array(record['embeddings'])
            documents = record['documents']
            
            # DBSCAN Clustering
            # eps=0.3 is a standard starting point for cosine/euclidean distance in normalized space
            clustering = DBSCAN(eps=0.3, min_samples=3, metric='cosine').fit(embeddings)
            
            clusters = collections.defaultdict(list)
            for i, label in enumerate(clustering.labels_):
                if label != -1: # -1 is noise
                    clusters[label].append(documents[i])
            
            # Summarize Clusters
            aspects = []
            for label, texts in clusters.items():
                # Naive Labeling: Most common significant word
                # In prod, we'd ask LLM: "Label this cluster: [texts]"
                aspects.append({
                    "cluster_id": int(label),
                    "size": len(texts),
                    "sample_text": texts[0][:100] + "..."
                })
                
            return aspects
            
        except Exception as e:
            print(f"ABSA Failed: {e}")
            return []

    def synthesize_answer(self, query, snippets, product_name, api_key=None):
        """Generates AI answer from snippets using Groq."""
        keys_to_try = [api_key, AppConfig.GROQ_API_KEY]
        valid_key = next((k for k in keys_to_try if k), None)

        if not valid_key:
            return "⚠️ I need a Groq API Key to answer this. Please check Settings."

        try:
            client = Groq(api_key=valid_key)
            context = "\n".join([f"- {s}" for s in snippets])
            prompt = f"Answer query '{query}' about '{product_name}' using these reviews:\n{context}\nBe helpful and specific."
            
            response = client.chat.completions.create(
                model="llama3-70b-8192",
                messages=[
                    {"role": "system", "content": "You are a helpful product assistant."},
                    {"role": "user", "content": prompt}
                ]
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"⚠️ AI Error: {e}"

    def generate_perception_summary(self, snippets, product_name, api_key=None):
        """High-level summary generation using Groq."""
        keys_to_try = [api_key, AppConfig.GROQ_API_KEY]
        valid_key = next((k for k in keys_to_try if k), None)

        if not valid_key: return "⚠️ Add Groq API Key for summaries."

        try:
            client = Groq(api_key=valid_key)
            context = "\n".join([f"- {s}" for s in snippets])
            prompt = f"""
            Analyze reviews for '{product_name}':
            {context}
            
            Output strictly 3 sections:
            1. **The Vibe**: 1 sentence summary.
            2. **Details**: Key pros/cons.
            3. **Verdict**: Buy or Avoid?
            """
            response = client.chat.completions.create(
                model="llama3-70b-8192",
                messages=[
                    {"role": "system", "content": "You are an expert product reviewer."},
                    {"role": "user", "content": prompt}
                ]
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"⚠️ AI Error: {e}"
