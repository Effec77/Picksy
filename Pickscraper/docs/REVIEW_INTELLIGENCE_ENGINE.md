# 🔍 Picksy Review Intelligence Engine

> **Component: Agent 2 - The "Truth Layer" of Picksy Ecosystem**

**Last Updated:** November 30, 2025  
**Version:** v0.3.0 (Planned)  
**Status:** Design Phase - Ready for Implementation

---

## 📋 Table of Contents

1. [What: System Definition](#what-system-definition)
2. [Why: Strategic Imperative](#why-strategic-imperative)
3. [How: Technical Architecture](#how-technical-architecture)
4. [Data Artifacts](#data-artifacts)
5. [Infrastructure Stack](#infrastructure-stack)
6. [Implementation Plan](#implementation-plan)

---

## 🎯 WHAT: System Definition

The **Picksy Review Intelligence Engine** is a specialized data processing subsystem designed to ingest, verify, and synthesize unstructured user feedback from across the web. It functions as the **"Truth Layer"** of the Picksy Ecosystem, distinct from standard search engines that merely aggregate raw star ratings.

### **Core Function**

**For Consumers (The "BS Detector"):**
A real-time filtration system that identifies and suppresses fraudulent, bot-generated, or incentivized reviews to reveal the true quality of a product.

### **Key Differentiator**

Unlike standard review aggregators that show raw star ratings, Picksy calculates a proprietary **Authenticity Score** to establish a unique data moat and become the primary source of truth for purchasing decisions.

---

## 💡 WHY: Strategic Imperative

### **2.1 Addressing the Trust Crisis**

**Problem:** Modern e-commerce is plagued by "Review Farms" and inflated ratings. Consumers no longer trust a 4.8-star rating on major platforms.

**Solution:** By calculating a proprietary Authenticity Score, Picksy establishes a unique data moat and becomes the primary source of truth for purchasing decisions.

**Impact:**
- Consumers get honest product assessments
- Reduces purchase hesitation
- Builds brand trust and loyalty

### **2.2 The Financial Bridge (Banking Integration)**

**Problem:** Purchase hesitation is a primary blocker to transaction volume.

**Solution:** By mathematically verifying product quality, the engine removes consumer doubt.

**Impact:**
- Accelerates "Decision-to-Buy" phase
- Increases card usage frequency
- Boosts transaction volume
- Directly benefits future Banking Strategy Agent (Agent 4)

### **2.3 B2B Monetization Potential**

**Problem:** Merchants require granular, verified data to reduce return rates and optimize inventory—insights they cannot get from standard analytics tools.

**Solution:** Business Intelligence Output provides actionable insights for product improvement.

**Impact:**
- Direct revenue stream from B2B clients
- Merchants can reduce return rates
- Optimize inventory based on verified feedback
- Improve product quality systematically

---

## 🏗️ HOW: Technical Architecture & Workflow

### **Phase A: The Ingestion & Canonicalization Layer**

**Objective:** Harvest data from hostile environments (Amazon/Google) and unify it into a single "Product Master Record."

#### **1.1 The Scraper Mesh (Extraction)**

**Challenge:** Direct scraping is impossible at scale due to IP bans.

**Solution: Proxy Mesh Architecture**

```
┌─────────────────────────────────────────────────┐
│         SCRAPER MESH ARCHITECTURE               │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────────────────────────────┐      │
│  │  Residential Rotating Proxies        │      │
│  │  (BrightData / ZenRows)              │      │
│  │  • Millions of residential IPs       │      │
│  │  • Simulate human traffic            │      │
│  └──────────────┬───────────────────────┘      │
│                 │                               │
│  ┌──────────────▼───────────────────────┐      │
│  │  Headless Browser Clusters           │      │
│  │  (Playwright + Celery Queue)         │      │
│  │  • Handle JS-heavy sites             │      │
│  │  • Distributed task processing       │      │
│  └──────────────┬───────────────────────┘      │
│                 │                               │
│  ┌──────────────▼───────────────────────┐      │
│  │  Adaptive Throttling System          │      │
│  │  • Monitor "Time-to-Ban" metrics     │      │
│  │  • Auto-reroute on detection         │      │
│  │  • Region X blocked → Route to Y     │      │
│  └──────────────────────────────────────┘      │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Components:**

1. **Residential Rotating Proxies**
   - Route requests through millions of residential IPs
   - Providers: BrightData, ZenRows
   - Simulate human traffic patterns

2. **Headless Browser Clusters**
   - For JS-heavy sites (Amazon, Flipkart)
   - Use Playwright instances
   - Managed by Celery task queue

3. **Adaptive Throttling**
   - Monitor "Time-to-Ban" metrics
   - If Amazon blocks Region X → Auto-reroute to Region Y
   - Dynamic rate limiting per domain

#### **1.2 The Canonicalization Algorithm (Identity Resolution)**

**Problem:** Amazon lists "Sony Alpha a7 III" while BestBuy lists "Sony ILCE7M3/B." How does Picksy know they are the same product?

**Solution: Two-Stage Matching Logic**

**Stage 1: Hard Match (The "Golden Key")**
```python
# Extract unique identifiers from page metadata
identifiers = extract_ids(page_html)  # GTIN, UPC, EAN, MPN

if scraped_upc == database_upc:
    return IMMEDIATE_MATCH
```

**Stage 2: Soft Match (Vector Embedding)**
```python
# If no unique ID found, use AI matching
if not hard_match:
    # Generate vector embedding
    embedding = SBERT.encode(
        product_title + image_hash
    )
    
    # Query vector database
    nearest = vector_db.search(embedding, k=1)
    similarity = cosine_similarity(embedding, nearest)
    
    if similarity > 0.92:
        return CONFIDENT_MATCH
    elif similarity > 0.85:
        return FLAG_FOR_HUMAN_REVIEW
    else:
        return NO_MATCH
```

**Thresholds:**
- **> 0.92**: Automatic match
- **0.85-0.92**: Flag for human review
- **< 0.85**: No match

#### **1.3 Normalized Review Object**

Every ingested review is converted into this standardized schema:

```json
{
  "review_id": "uuid_v4",
  "product_id": "canonical_master_id",
  "source_platform": "amazon_us",
  "original_rating": 5,
  "author_id_hash": "sha256_hash",
  "timestamp_utc": "2023-10-27T14:30:00Z",
  "content_text": "Battery died after two weeks...",
  "verified_purchase": true,
  "images_attached": 2
}
```

---

### **Phase B: The Processing Layer (The "Truth Filter")**

**Objective:** Mathematically separate legitimate human feedback from noise, bots, and paid shills.

#### **2.1 Deduplication (The "Echo" Remover)**

**Problem:** Sellers pay bot farms to copy-paste the same 5-star review across hundreds of listings.

**Solution: MinHash / LSH (Locality Sensitive Hashing)**

```python
# Compute Jaccard similarity of review text
similarity = jaccard_similarity(review_a, review_b)

if similarity > 0.90 and author_a != author_b:
    flag_as("suspected_bot_farm")
```

**Detection Logic:**
- If two reviews share >90% text similarity
- But have different Author IDs
- Both flagged as `suspected_bot_farm`

#### **2.2 The Authenticity Scoring Model** ⭐

**This is the core IP of Picksy.**

**Architecture: Hybrid Ensemble Model**

```
┌─────────────────────────────────────────────────┐
│      AUTHENTICITY SCORING MODEL                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────────────────────────────┐      │
│  │  A. Metadata Classifier (XGBoost)    │      │
│  │  Analyzes behavioral features        │      │
│  │  • Burstiness (50 reviews in 1 hr?)  │      │
│  │  • Account Age (< 24 hours old?)     │      │
│  │  • Deviation (Outlier pattern?)      │      │
│  │                                      │      │
│  │  Output: MetadataScore (0-1)         │      │
│  └──────────────┬───────────────────────┘      │
│                 │                               │
│  ┌──────────────▼───────────────────────┐      │
│  │  B. Semantic Classifier               │      │
│  │  (DistilRoBERTa)                     │      │
│  │  Analyzes text content               │      │
│  │  • Generic: "Great product!" (Low)   │      │
│  │  • Specific: "Hinge snapped" (High)  │      │
│  │                                      │      │
│  │  Output: SemanticScore (0-1)         │      │
│  └──────────────┬───────────────────────┘      │
│                 │                               │
│  ┌──────────────▼───────────────────────┐      │
│  │  Final Score Calculation             │      │
│  │                                      │      │
│  │  Score = (0.4 × Metadata) +          │      │
│  │          (0.6 × Semantic)            │      │
│  │                                      │      │
│  │  < 0.4: Discard (Bot/Spam)           │      │
│  │  0.4-0.7: Flag (Use with caution)    │      │
│  │  > 0.7: Verify (Include in analysis) │      │
│  └──────────────────────────────────────┘      │
│                                                 │
└─────────────────────────────────────────────────┘
```

**A. Metadata Classifier (XGBoost)**

Analyzes tabular behavioral features:

| Feature | Signal | Interpretation |
|---------|--------|----------------|
| **Burstiness** | 50 reviews in 1 hour | Attack/Farm |
| **Account Age** | < 24 hours old | Suspicious |
| **Deviation** | 5-star outlier from user's 1-star history | Paid review |
| **Verified Purchase** | No verification badge | Lower trust |
| **Review Length** | < 10 words | Generic/Bot |

**B. Semantic Classifier (DistilRoBERTa)**

Analyzes text content:

| Pattern | Example | Score |
|---------|---------|-------|
| **Generic** | "Great product fast shipping" | Low (Suspicious) |
| **Specific Experience** | "The plastic hinge snapped when I folded it" | High (Authentic) |
| **Emotional Detail** | "I was so disappointed when..." | High (Authentic) |
| **Copy-Paste** | Exact match with other reviews | Very Low (Bot) |

**Final Score Calculation:**

```python
authenticity_score = (0.4 * metadata_score) + (0.6 * semantic_score)

if authenticity_score < 0.4:
    action = "DISCARD"  # Bot/Spam
elif authenticity_score < 0.7:
    action = "FLAG"  # Use with caution
else:
    action = "VERIFY"  # Include in analysis
```

#### **2.3 Aspect-Based Sentiment Analysis (ABSA)**

**Goal:** Don't just calculate "Positive" or "Negative." Extract specific product aspects and their sentiment.

**Method: Unsupervised Clustering (HDBSCAN)**

```
Step 1: Embed all review sentences
        ↓
Step 2: Cluster them in vector space
        ↓
Step 3: Use LLM to label cluster centers
```

**Example Output:**

| Cluster | Keywords | Label | Sentiment |
|---------|----------|-------|-----------|
| A | "Battery", "Charge", "Power" | Battery Life | 🔴 Negative (72%) |
| B | "Fit", "Ear", "Pain" | Comfort | 🟡 Neutral (55%) |
| C | "Sound", "Bass", "Quality" | Audio Quality | 🟢 Positive (88%) |

---

### **Phase C: Output Generation Logic**

#### **3.1 Consumer Output (Agent 2)**

**Constraint:** Low Latency (< 500ms)

**Architecture: Read-Through Cache Strategy**

```
User Query: "Is the Sony XM5 good?"
        ↓
Cache Check: Redis key "summary:sony_xm5"
        ↓
    ┌───┴───┐
    │       │
  HIT      MISS
    │       │
    │       ├─→ Trigger Async Analysis Job
    │       ├─→ Return "Preliminary Data"
    │       ├─→ Show "Picksy is digging deeper..."
    │       └─→ Push update via WebSocket when ready
    │
    └─→ Return pre-computed Verdict Card instantly
```

**Consumer Verdict Card:**

```
┌─────────────────────────────────────────────────┐
│  🔍 Picksy Truth Verdict                        │
├─────────────────────────────────────────────────┤
│                                                 │
│  Product: Sony WH-1000XM5                       │
│                                                 │
│  📊 Real Authenticity Score: 72%                │
│  ⭐ Adjusted Rating: 3.4/5.0                    │
│  (Public rating: 4.5/5.0)                       │
│                                                 │
│  ⚠️  Warning: 28% of reviews show bot patterns  │
│                                                 │
│  🔴 Top Issue: Battery Life (412 mentions)      │
│  "Battery died after two weeks of normal use"   │
│                                                 │
│  🟢 Top Praise: Sound Quality (800 mentions)    │
│  "Better bass than Bose"                        │
│                                                 │
│  💡 Picksy Verdict: WAIT                        │
│  "Quality concerns with battery. Consider       │
│  alternatives or wait for next version."        │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### **3.2 Business Output (Agent 3 - The Excel Generator)**

**Constraint:** Accuracy & Detail

**Architecture:** Batch Processing

**The "Consultant" Prompt Logic:**

To generate the "Engineering Action Plan," we use a **Chain-of-Thought prompt pipeline**:

```python
# Input Data
cluster_data = {
    "cluster": "Hinge",
    "sentiment": "92% Negative",
    "keywords": ["Snap", "Plastic", "90-degrees"]
}

# Prompt Instruction
prompt = """
Act as a Senior Product Engineer. Based on the input data:
1. Identify the mechanical failure point
2. Propose a material science solution
3. Estimate feasibility and cost impact

Input: {cluster_data}
"""

# LLM Output
output = """
Failure point: Stress fracture at 90-degree torque.
Solution: Upgrade hinge material to ABS-Polycarbonate blend.
Feasibility: High. Cost increase: ~₹15 per unit.
Expected return rate reduction: 40%.
"""

# Final Step: Inject into Excel Cell E5
excel_writer.write_cell("E5", output)
```

---

## 📊 DATA ARTIFACTS: The Business Audit Output

**File Standard:** `Picksy_Business_Audit_[ProductName]_[Date].xlsx`

### **Tab 1: Executive Overview (The "Boss" View)**

**Goal:** High-level snapshot for CEO/Product Manager

| Metric | Value | Picksy Insight |
|--------|-------|----------------|
| **Real Authenticity Score** | 72% | ⚠️ Warning: 28% of reviews exhibit bot-like patterns |
| **Adjusted Star Rating** | 3.4/5.0 | Public Amazon rating is 4.5, but verified humans rate it lower |
| **Top Sentiment Driver** | "Battery Life" | Negative sentiment spiked 15% in last 30 days |
| **Lost Revenue Est.** | ₹12,500/mo | Based on customers mentioning returns due to Component X |

### **Tab 2: Thematic Breakdown (The "Money Maker" Tab)**

**Goal:** Specific instructions for Engineering and Marketing teams

| Theme/Component | Sentiment | Frequency | Severity | Picksy AI Action Plan (Engineering) | Picksy AI Action Plan (Marketing) |
|-----------------|-----------|-----------|----------|-------------------------------------|-----------------------------------|
| **Plastic Hinge** | 🔴 Negative | 412 mentions | High | Replace material: Users report snapping at 90-degree angle. Switch to reinforced ABS or Aluminum alloy 6061 for next batch. | Stop claiming "Rugged": Remove "Military Grade" from description until fixed to lower return rate. |
| **Bluetooth Pairing** | 🟡 Neutral | 150 mentions | Med | Firmware Update: 40% of complaints mention iOS 17 specific lag. Prioritize firmware patch v2.1. | Update Manual: Create "Quick Start" QR code video for iPhone users to reduce support tickets. |
| **Sound Quality** | 🟢 Positive | 800 mentions | Low | Maintain: Users love bass response. Do not alter driver specs in cost-cutting. | Highlight in Ads: Use quote "Better bass than Bose" in Q4 campaigns (Verified Authentic Quote). |

### **Tab 3: Evidence Ledger (The "Proof")**

**Goal:** Proof that AI isn't hallucinating. Used for auditing and verification.

| Date | Source | Authenticity | Theme | Quote Snippet | Flag Reason |
|------|--------|--------------|-------|---------------|-------------|
| Oct 24 | Amazon | ✅ High | Hinge | "...broke after 3 weeks of normal use..." | N/A |
| Oct 22 | Reddit | ✅ High | Hinge | "Don't buy this, the hinge is garbage." | Verified Account |
| Oct 20 | Amazon | ❌ Low | General | "Best product ever! fast shipping!" | Suspicious: 100% match with 5 other reviews on same day |

---

## 🔧 INFRASTRUCTURE STACK

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Orchestration** | Python + Airflow | Managing dependency graph: scraping → cleaning → scoring |
| **Queues** | Redis + Celery | Handling millions of scrape tasks asynchronously |
| **Database (Relational)** | PostgreSQL | Storing metadata, user accounts, product masters |
| **Database (Vector)** | Qdrant / Milvus | Storing review embeddings for semantic search and clustering |
| **ML Inference** | ONNX Runtime | Running Authenticity Model efficiently on CPU |
| **LLM Layer** | OpenAI API / Local LLaMA | Generating summaries and action plans |
| **Proxy Service** | BrightData / ZenRows | Residential proxy rotation |
| **Browser Automation** | Playwright | Headless browser for JS-heavy sites |
| **Caching** | Redis | Low-latency consumer output |

---

## 📅 IMPLEMENTATION PLAN

### **Phase 1: Foundation (Week 1-2)**

**Week 1: Scraper Mesh**
- [ ] Set up proxy service (BrightData/ZenRows)
- [ ] Build Playwright scraper for Amazon
- [ ] Implement Celery task queue
- [ ] Add adaptive throttling logic
- [ ] Test scraping 1000 reviews

**Week 2: Canonicalization**
- [ ] Build product ID extraction (UPC/EAN/MPN)
- [ ] Implement SBERT vector matching
- [ ] Set up Qdrant vector database
- [ ] Create normalized review schema
- [ ] Test product matching accuracy

**Deliverables:**
- ✅ Working scraper mesh (1000+ reviews/hour)
- ✅ Product canonicalization (>92% accuracy)
- ✅ Normalized review database

---

### **Phase 2: Truth Filter (Week 3-4)**

**Week 3: Authenticity Model**
- [ ] Implement deduplication (MinHash/LSH)
- [ ] Build metadata classifier (XGBoost)
- [ ] Train semantic classifier (DistilRoBERTa)
- [ ] Create ensemble scoring logic
- [ ] Validate on labeled dataset

**Week 4: ABSA**
- [ ] Implement sentence embedding
- [ ] Build HDBSCAN clustering
- [ ] Create LLM labeling pipeline
- [ ] Extract aspect-sentiment pairs
- [ ] Test on 10 products

**Deliverables:**
- ✅ Authenticity scoring model (>85% accuracy)
- ✅ Aspect-based sentiment analysis
- ✅ Bot/spam detection

---

### **Phase 3: Output Generation (Week 5-6)**

**Week 5: Consumer Output**
- [ ] Build Redis caching layer
- [ ] Create Verdict Card UI
- [ ] Implement WebSocket updates
- [ ] Add async analysis jobs
- [ ] Optimize for <500ms latency

**Week 6: Business Output**
- [ ] Design Excel template
- [ ] Build Chain-of-Thought prompts
- [ ] Implement XlsxWriter integration
- [ ] Create batch processing pipeline
- [ ] Test with 5 real products

**Deliverables:**
- ✅ Consumer Verdict Card (<500ms)
- ✅ Business Audit Excel generator
- ✅ End-to-end pipeline working

---

### **Phase 4: Integration & Polish (Week 7-8)**

**Week 7: Extension Integration**
- [ ] Integrate with Picksy extension
- [ ] Add "Truth Verdict" tab
- [ ] Implement loading states
- [ ] Add error handling
- [ ] User testing

**Week 8: Optimization**
- [ ] Performance tuning
- [ ] Cost optimization
- [ ] Monitoring and alerts
- [ ] Documentation
- [ ] Production deployment

**Deliverables:**
- ✅ Full integration with Picksy
- ✅ Production-ready system
- ✅ Monitoring dashboard

---

## 💰 COST ESTIMATION

**For 1000 Users (10 products analyzed/user/month):**

| Component | Cost/Month | Notes |
|-----------|------------|-------|
| **Proxy Service** | $100-200 | BrightData residential proxies |
| **Vector Database** | $20-50 | Qdrant Cloud or self-hosted |
| **LLM API** | $50-150 | OpenAI GPT-4 for summaries |
| **Hosting** | $50-100 | Railway/AWS for backend |
| **ML Inference** | $20-40 | ONNX Runtime on CPU |
| **Total** | **$240-540** | **$0.24-0.54 per user** |

**B2B Revenue Potential:**
- Business Audit Report: ₹5,000-10,000 per product
- Monthly subscription: ₹25,000-50,000 for brands
- ROI: Positive after 50-100 B2B clients

---

## 🎯 SUCCESS METRICS

### **Technical Metrics**

- **Scraping Success Rate**: >90%
- **Product Match Accuracy**: >92%
- **Authenticity Model Accuracy**: >85%
- **Consumer Output Latency**: <500ms
- **ABSA Cluster Quality**: >80% human agreement

### **User Metrics**

- **Trust Score**: 85%+ users trust Picksy over Amazon ratings
- **Feature Usage**: 70%+ users check Truth Verdict
- **Decision Impact**: 60%+ users change decision based on verdict

### **Business Metrics**

- **B2B Clients**: 50+ brands using Business Audit
- **Revenue**: ₹10L+/month from B2B
- **Return Rate Reduction**: 30%+ for client brands

---

## 🚀 FUTURE ENHANCEMENTS

### **Phase 2 Features**

- **Multi-language Support**: Analyze reviews in Hindi, Tamil, etc.
- **Image Analysis**: Analyze user-uploaded product images
- **Video Reviews**: Transcribe and analyze YouTube reviews
- **Competitor Comparison**: Compare products side-by-side
- **Trend Detection**: Alert brands to emerging issues

### **Advanced AI**

- **Custom LLM**: Fine-tune model specifically for review analysis
- **Real-time Monitoring**: Alert brands to review attacks
- **Predictive Analytics**: Predict return rates before launch
- **Sentiment Forecasting**: Predict future sentiment trends

---

**Made with 🔍 for truth-seeking shoppers**

*Last Updated: November 30, 2025*  
*Version: 0.3.0 (Planned)*  
*Status: Design complete, ready for implementation*  
*Core IP: Authenticity Scoring Model (Hybrid Ensemble)*
