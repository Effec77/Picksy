# 🔄 Picksy Agent Structure Update

**Date:** November 30, 2025  
**Status:** Documentation Complete

---

## 📋 New Agent Structure

Picksy now uses **three specialized AI agents** instead of the previous structure:

### **Agent 1: Miscellaneous AI Agent** 🎯
**Role:** Comprehensive utility agent (flexible and open to future enhancements)

**Current Features:**
- ✅ Automatic price comparison across 10+ legit sites
- ✅ Price history tracking (up to 50 data points)
- ✅ Visual graphs and charts (SVG-based)
- ✅ Smart search across competitors
- ✅ Site management (16 verified sites)
- ✅ Basic alerts and notifications

**New Features (Phase 2):**
- ⏳ Email notifications (SendGrid/AWS SES/Mailgun/Resend)
- ⏳ Backend API for universal scraping
- ⏳ AI-powered extraction (Gemini Pro or GPT-4 Vision)
- ⏳ Parallel scraping (5-10 seconds for 10 sites)

**Future Enhancements (Open to Changes):**
- Product tags and categories
- Advanced filtering and sorting
- Bulk operations
- Export/import data
- Enhanced interactive charts
- Custom alert rules
- Browser sync across devices
- Coupon code integration
- Cashback tracking
- Wishlist management

---

### **Agent 2: Review Intelligence Engine** 🔍
**Role:** The "Truth Layer" - AI-powered review verification and analysis

**Core Function:**
- **For Consumers**: "BS Detector" that filters fake/bot reviews
- **For Businesses**: Automated consultant providing actionable insights

**Features (Phase 3):**

**Phase A: Ingestion & Canonicalization**
- ⏳ Scraper Mesh (Residential proxies + Playwright)
- ⏳ Product Identity Resolution (UPC matching + SBERT)
- ⏳ Normalized Review Database

**Phase B: Truth Filter**
- ⏳ Deduplication (MinHash/LSH for bot detection)
- ⏳ **Authenticity Scoring Model** (Core IP)
  - Metadata Classifier (XGBoost): Burstiness, account age, deviation
  - Semantic Classifier (DistilRoBERTa): Generic vs specific content
  - Hybrid Score: (0.4 × Metadata) + (0.6 × Semantic)
- ⏳ Aspect-Based Sentiment Analysis (HDBSCAN clustering)

**Phase C: Output Generation**
- ⏳ Consumer Output: Truth Verdict Card (<500ms via Redis cache)
- ⏳ Business Output: Excel Audit Report with action plans

**Key Metrics:**
- **Real Authenticity Score**: % of verified human reviews
- **Adjusted Star Rating**: True rating after filtering bots
- **Thematic Breakdown**: Engineering + Marketing action plans

**Tech Stack:**
- **Orchestration**: Python + Airflow
- **Queues**: Redis + Celery
- **Databases**: PostgreSQL + Qdrant (vector)
- **ML**: XGBoost + DistilRoBERTa + ONNX Runtime
- **LLM**: OpenAI GPT-4 / Local LLaMA
- **Proxies**: BrightData / ZenRows

**Documentation:** See `docs/REVIEW_INTELLIGENCE_ENGINE.md` ✅

---

### **Agent 3: Recommendation Agent** 🧠
**Role:** AI-powered buying recommendations and decision support

**Features (Phase 4):**
- ⏳ Smart recommendations (BUY/WAIT/AVOID with reasoning)
- ⏳ Deal scoring (0-10 scale with breakdown)
- ⏳ Price prediction (30-day forecast with confidence)
- ⏳ Best time to buy (sale event detection)
- ⏳ Alternative suggestions (better value products)
- ⏳ Personalized insights (budget-aware, preference-based)

**Tech Stack:**
- GPT-4 or Claude 3 for recommendation generation
- Time series analysis for price prediction
- Machine learning for deal scoring

**Documentation:** See `docs/RECOMMENDATION_AGENT.md`

---

## 🔄 What Changed?

### **Old Structure:**
1. Agent 1: Price Comparison (only)
2. Agent 2: Recommendation (mixed features)
3. Agent 3: Misc (support services)

### **New Structure:**
1. Agent 1: **Misc Agent** (price comparison + all utilities)
2. Agent 2: **Review Intelligence** (dedicated review analysis)
3. Agent 3: **Recommendation** (dedicated buying decisions)

---

## 🎯 Why This Structure?

1. **Better Separation of Concerns**
   - Agent 1: All price-related features + utilities
   - Agent 2: All review-related features
   - Agent 3: All recommendation-related features

2. **Flexibility**
   - Misc Agent can easily accommodate new utility features
   - Each agent can scale independently
   - Clear boundaries between agents

3. **Maintainability**
   - Easier to update and debug
   - Clear responsibility for each agent
   - Parallel development possible

---

## 📅 Implementation Timeline

### **Phase 2: Misc Agent** (4-6 weeks) - IN PROGRESS
- Week 1-2: MVP with invisible tabs
- Week 3-4: Backend API + AI extraction
- Week 5-6: Email notifications + optimization

### **Phase 3: Review Intelligence** (3-4 weeks) - PLANNED
- Week 1-2: Review scraping + sentiment analysis
- Week 3: Summarization + insights
- Week 4: Integration + UI

### **Phase 4: Recommendation Agent** (3-4 weeks) - PLANNED
- Week 1: Deal scoring
- Week 2: Price prediction
- Week 3: Recommendations
- Week 4: Personalization

### **Phase 5: Enhanced Features** (2-3 weeks) - PLANNED
- Misc Agent enhancements (tags, filters, sync, etc.)

---

## 💰 Cost Estimation

**For 1000 users:**

**Phase 2 (Misc Agent):**
- Gemini Pro (FREE) + Railway hosting: $20/month
- OR GPT-4 Vision + Railway: $120/month

**Phase 3 (Review Intelligence):**
- Proxy Service: $100-200/month
- Vector Database: $20-50/month
- LLM API: $50-150/month
- Total: $240-540/month

**Phase 4 (Recommendation):**
- Add $20-40/month for recommendations

**Total (Production):** $300-760/month ($0.30-0.76 per user)

**B2B Revenue Potential (Review Intelligence):**
- Business Audit Report: ₹5,000-10,000 per product
- Monthly subscription: ₹25,000-50,000 for brands
- ROI: Positive after 50-100 B2B clients

---

## 📚 Documentation

1. **AGENT_STRUCTURE_UPDATE.md** - Agent structure summary ✅
2. **MISC_AGENT_COMPLETE.md** - Misc Agent (Price Comparison) specs (complete) ✅
3. **REVIEW_INTELLIGENCE_ENGINE.md** - Review Intelligence specs (complete) ✅
4. **RECOMMENDATION_AGENT.md** - Recommendation Agent specs (complete) ✅
5. **README.md** - User-facing documentation ✅

**Legacy:**
- **AUTOMATIC_PRICE_COMPARISON_PLAN.md** - Original price comparison plan

---

## ✅ Next Steps

1. **Update session_context.md** with new agent structure
2. **Review** the Recommendation Agent documentation with team
3. **Decide** on Phase 2 implementation approach:
   - AI provider (Gemini Pro vs GPT-4 Vision)
   - Scraping method (Invisible tabs vs Backend API)
   - Email service (SendGrid vs AWS SES vs Mailgun vs Resend)
   - Hosting (Railway vs Heroku vs AWS Lambda)
4. **Start** Phase 2 implementation

---

**Made with 🧠 for smart shoppers**

*Last Updated: November 30, 2025*
