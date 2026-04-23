# 🚀 Picksy - AI-Powered Smart Shopping Assistant

> **Save money. Shop smarter. Trust verified.**

**Version:** v0.1.0 → v0.2.0 (AI Agents in Development)  
**Status:** Production MVP Complete, Transitioning to AI-Powered Agents  
**Last Updated:** November 30, 2025

---

## 📋 What is Picksy?

Picksy is an **AI-powered Chrome extension** that helps you make smarter purchasing decisions by:

- 🔍 **Verifying Reviews**: Filtering fake reviews to show you the truth
- 💰 **Comparing Prices**: Automatically finding the best deals across 10+ legit sites
- 🤖 **Smart Recommendations**: AI-powered BUY/WAIT/AVOID decisions
- 📊 **Price Tracking**: Monitoring price history and alerting you to drops
- ✉️ **Email Alerts**: Getting notified when prices drop or products restock

---

## 🎯 Core Philosophy

**We are 100% legit. No sneaky websites. No scams. Only verified, authentic sites.**

- ✅ Only scrape from verified, trusted e-commerce sites
- ✅ AI-powered universal extraction (works on ANY site)
- ✅ User privacy first (local processing where possible)
- ✅ No hardcoded selectors (AI adapts to site changes)
- ✅ Professional, production-ready quality

---

## 🤖 The Three AI Agents

Picksy is powered by three specialized AI agents working together:

### **Agent 1: Miscellaneous AI Agent** 🎯
**Your Price & Utility Hub**

- Automatic price comparison across 10+ sites (5-10 seconds)
- Price history tracking (up to 50 data points)
- Email notifications for price drops
- Visual price charts and trends
- Smart search across competitors
- Site management (16 verified sites)

**Future:** Tags, filters, coupons, cashback, sync

### **Agent 2: Review Intelligence Engine** 🔍
**The "Truth Layer" - Your BS Detector**

- **Authenticity Scoring**: Filters fake/bot reviews
- **Real Ratings**: Shows adjusted ratings after removing spam
- **Sentiment Analysis**: Breaks down pros/cons by product aspect
- **Quality Insights**: Identifies common defects and issues
- **Truth Verdict**: Clear assessment of product quality

**For Businesses:** Excel audit reports with engineering action plans

### **Agent 3: Recommendation Agent** 🧠
**Your AI Shopping Advisor**

- **Smart Recommendations**: Clear BUY/WAIT/AVOID decisions
- **Deal Scoring**: 0-10 scale showing how good the deal is
- **Price Prediction**: Forecasts if price will drop in 30 days
- **Best Time to Buy**: Identifies upcoming sales
- **Alternatives**: Suggests better value products
- **Personalized**: Adapts to your budget and preferences

---

## ✨ Current Features (v0.1.0)

### **Product Detection**
- Works on Amazon, Flipkart, Myntra, Nike, Adidas, Puma
- Extracts: title, price, stock, rating, reviews, seller
- Multi-currency support (INR, USD, EUR, GBP, CAD)

### **Price History**
- Stores up to 50 data points per product
- Visual SVG charts
- Shows lowest, highest, current prices
- Percentage change indicators

### **Background Monitoring**
- Automatic scans every 6 hours
- Updates price history automatically
- Smart notifications

### **Smart Notifications**
- Price drop alerts with percentage
- Stock availability alerts
- Target price reached alerts
- Clickable notifications

### **Trust Signals**
- Product ratings (0-5 stars)
- Review counts
- Seller information
- Official brand badges
- Confidence scoring (0-100%)

### **Modern UI/UX**
- Gradient header with branding
- Beautiful empty states
- Smooth animations
- Loading states
- Error handling
- Toast notifications

---

## 🗺️ Roadmap

### **Phase 2: Miscellaneous AI Agent** (4-6 weeks) - IN PROGRESS
- ⏳ Automatic price comparison (10+ sites in 5-10 seconds)
- ⏳ Email notifications
- ⏳ Backend API with AI extraction
- ⏳ Universal scraping (works on ANY site)

### **Phase 3: Review Intelligence Engine** (3-4 weeks) - PLANNED
- ⏳ Authenticity scoring model
- ⏳ Fake review detection
- ⏳ Truth Verdict cards
- ⏳ Business audit reports

### **Phase 4: Recommendation Agent** (3-4 weeks) - PLANNED
- ⏳ BUY/WAIT/AVOID recommendations
- ⏳ Deal scoring (0-10)
- ⏳ Price predictions
- ⏳ Alternative suggestions

### **Phase 5: Enhanced Features** (2-3 weeks) - PLANNED
- ⏳ Product tags and categories
- ⏳ Advanced filtering
- ⏳ Browser sync
- ⏳ Coupon integration
- ⏳ Cashback tracking

---

## 🏗️ Technical Stack

### **Frontend**
- Pure Vanilla JavaScript (no frameworks)
- Chrome Extensions Manifest V3
- HTML5 + CSS3

### **Backend (Coming Soon)**
- Node.js + Express
- Puppeteer (headless browser)
- Gemini Pro / GPT-4 Vision (AI extraction)
- Railway hosting

### **AI Services**
- **Price Extraction**: Gemini Pro (FREE) or GPT-4 Vision
- **Review Analysis**: GPT-4 + DistilRoBERTa + XGBoost
- **Recommendations**: GPT-4 / Claude 3

### **Infrastructure**
- PostgreSQL (relational data)
- Qdrant (vector database)
- Redis (caching)
- Celery (task queue)

---

## 💰 Pricing

**For Consumers:** FREE

**For Businesses (Coming Soon):**
- Business Audit Report: ₹5,000-10,000 per product
- Monthly Subscription: ₹25,000-50,000 for brands
- Features: Review analysis, return rate insights, action plans

---

## 🎯 Verified Sites

### **Tier 1: Official Brand Stores** (Trust: 10/10)
- Apple, Samsung, Nike, Adidas, Puma, Optimum Nutrition

### **Tier 2: Major Marketplaces** (Trust: 9/10)
- Amazon India, Flipkart, Myntra, Ajio, Tata CLiQ

### **Tier 3: Verified Retailers** (Trust: 8/10)
- Croma, Reliance Digital, Vijay Sales, Healthkart, Nykaa

---

## 📚 Documentation

### **For Developers**
- `AGENT_STRUCTURE_UPDATE.md` - Agent architecture overview
- `RECOMMENDATION_AGENT.md` - Recommendation agent specs
- `REVIEW_INTELLIGENCE_ENGINE.md` - Review intelligence specs
- `AUTOMATIC_PRICE_COMPARISON_PLAN.md` - Price comparison details

### **For Users**
- This README
- In-extension help and tooltips
- FAQ (coming soon)

---

## 🚀 Getting Started

### **Installation**
1. Download the extension from Chrome Web Store (coming soon)
2. Or load unpacked from `extension/` folder for development

### **Usage**
1. Visit any supported e-commerce site
2. Click the Picksy icon in your browser
3. View price history, comparisons, and recommendations
4. Set target prices and get alerts

---

## 🤝 Contributing

We're not open source yet, but we're building in public! Follow our progress:
- Documentation updates in `/docs`
- Feature roadmap in this README
- Implementation progress tracked in issues

---

## 📧 Contact

- **Email**: [Your Email]
- **Twitter**: [Your Twitter]
- **Website**: [Your Website]

---

## 📄 License

Proprietary - All Rights Reserved

---

**Made with ❤️ for smart shoppers everywhere**

*Picksy - Because you deserve the truth.*
