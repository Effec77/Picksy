# 🧠 Picksy Recommendation Agent

> **AI-Powered Buying Recommendations for Smart Shopping**

**Last Updated:** November 30, 2025  
**Version:** v0.4.0 (Planned)  
**Status:** Design Phase - Ready for Implementation

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Core Purpose](#core-purpose)
3. [Key Features](#key-features)
4. [Technical Architecture](#technical-architecture)
5. [Recommendation Logic](#recommendation-logic)
6. [Implementation Plan](#implementation-plan)
7. [API Specifications](#api-specifications)
8. [UI/UX Design](#uiux-design)



## 🎯 Overview

### **What is the Recommendation Agent?**

The Recommendation Agent is an AI-powered decision engine that analyzes product data, price trends, review insights, and market conditions to provide intelligent BUY, WAIT, or AVOID recommendations with clear reasoning and confidence scores.

### **Core Philosophy**

- **Data-Driven**: Decisions based on multiple data sources
- **Transparent**: Clear reasoning for every recommendation
- **Personalized**: Adapts to user preferences and budget
- **Actionable**: Provides specific next steps
- **Trustworthy**: Confidence scores and uncertainty indicators

---

## 🎯 Core Purpose

### **Primary Goals**

1. **Help users make informed buying decisions**
   - Should I buy this product now?
   - Should I wait for a better deal?
   - Should I avoid this product entirely?

2. **Save users money**
   - Identify overpriced products
   - Predict upcoming price drops
   - Find better alternatives

3. **Save users time**
   - No need to research manually
   - Quick, clear recommendations
   - One-click access to alternatives

4. **Build trust**
   - Explain reasoning clearly
   - Show confidence levels
   - Admit uncertainty when appropriate

---

## ✨ Key Features

### **1. Smart Buying Recommendations**


**Three Clear Recommendations:**

```
🟢 BUY NOW
"Excellent deal! Price is 15% below average and reviews are outstanding."
Confidence: 92%

🟡 WAIT
"Price is average. Historical data suggests a 20% drop likely in 2 weeks."
Confidence: 78%

🔴 AVOID
"Overpriced by 25% and reviews indicate quality issues."
Confidence: 88%
```

**Recommendation Factors:**
- Current price vs historical average
- Competitor price comparison
- Review quality and sentiment
- Stock availability and urgency
- Seasonal trends and patterns
- User's budget and preferences

### **2. Deal Scoring System**

**0-10 Scale with Clear Categories:**

```
9-10: 🔥 EXCEPTIONAL DEAL (Top 5% of deals)
7-8:  ⭐ GREAT DEAL (Better than 80% of prices)
5-6:  ✅ GOOD DEAL (Fair price, safe to buy)
3-4:  ⚠️  AVERAGE (Not a deal, but not overpriced)
0-2:  ❌ POOR DEAL (Overpriced, wait or avoid)
```

**Deal Score Calculation:**
```javascript
dealScore = (
  priceScore * 0.40 +        // 40% weight: Price vs average
  competitorScore * 0.25 +   // 25% weight: vs competitors
  reviewScore * 0.20 +       // 20% weight: Review quality
  trendScore * 0.10 +        // 10% weight: Price trend
  urgencyScore * 0.05        //  5% weight: Stock/demand
)
```

### **3. Price Prediction**

**Predict Future Price Movement:**

```
📈 Price Prediction (Next 30 Days)

Current Price: ₹48,990
Predicted Range: ₹46,500 - ₹49,500
Confidence: 75%

📊 Probability:
• 60% - Price will drop 3-5%
• 30% - Price will stay stable
• 10% - Price will increase

💡 Recommendation: Wait 2-3 weeks for potential ₹2,000 savings
```

**Prediction Factors:**
- Historical price patterns (6-12 months)
- Seasonal trends (festivals, sales events)
- Competitor price movements
- Stock levels and demand indicators
- Product lifecycle stage (new, mature, end-of-life)

### **4. Best Time to Buy**

**Optimal Purchase Timing:**

```
⏰ Best Time to Buy

🎯 Recommended: December 15-20, 2025
   Expected Price: ₹46,990 (4% lower)
   Reason: Annual year-end sale

📅 Alternative: January 26, 2026
   Expected Price: ₹45,990 (6% lower)
   Reason: Republic Day sale

⚠️  Risk: Stock may run out during peak sale
```

**Timing Factors:**
- Upcoming sales events (Diwali, Black Friday, etc.)
- Historical sale patterns
- Stock availability trends
- Product refresh cycles
- Seasonal demand patterns

### **5. Alternative Product Suggestions**

**Find Better Value:**

```
💡 Better Alternatives Found

1. Samsung Galaxy S24 - ₹44,990
   ✅ 12% cheaper
   ✅ Better camera (4.7/5 vs 4.3/5)
   ✅ Longer battery life
   ⚠️  Slightly heavier

2. OnePlus 12 - ₹46,990
   ✅ 4% cheaper
   ✅ Faster charging
   ✅ Higher refresh rate
   ⚠️  Fewer reviews

Deal Score: 8.5/10 vs 7.2/10 (current product)
```

**Alternative Criteria:**
- Similar features and specifications
- Better price-to-value ratio
- Higher review ratings
- Same or better brand reputation
- Available in stock

### **6. Personalized Insights**

**Learn and Adapt:**

```
🎯 Personalized for You

Based on your browsing:
• You prefer premium brands (Apple, Samsung)
• Your budget range: ₹40,000 - ₹60,000
• You value camera quality over battery
• You typically buy during sales

💡 Custom Recommendation:
Wait for upcoming sale (Dec 15) to get this within your preferred price range.
```

**Personalization Factors:**
- Browsing history (products viewed)
- Price sensitivity (budget range)
- Feature preferences (camera, battery, etc.)
- Brand preferences
- Purchase timing patterns

---

## 🏗️ Technical Architecture

### **System Overview**

```
┌─────────────────────────────────────────────────┐
│         PICKSY CHROME EXTENSION                 │
│              (User Interface)                   │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│       RECOMMENDATION AGENT (Backend API)        │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐  ┌──────────────┐           │
│  │ Data Fetcher │  │ AI Analyzer  │           │
│  └──────┬───────┘  └──────┬───────┘           │
│         │                  │                    │
│         ▼                  ▼                    │
│  ┌──────────────────────────────┐              │
│  │   Recommendation Engine      │              │
│  │  • Deal Scorer               │              │
│  │  • Price Predictor           │              │
│  │  • Alternative Finder        │              │
│  │  • Personalization Engine    │              │
│  └──────────────┬───────────────┘              │
│                 │                               │
└─────────────────┼───────────────────────────────┘
                  │
                  ▼
         ┌────────────────┐
         │  Data Sources  │
         ├────────────────┤
         │ • Agent 1      │
         │   (Prices)     │
         │ • Agent 2      │
         │   (Reviews)    │
         │ • User Data    │
         └────────────────┘
```

### **Tech Stack**

**Backend:**
- Node.js + Express (or Python + FastAPI)
- GPT-4 or Claude 3 for AI analysis
- TensorFlow.js for price prediction ML
- Redis for caching
- PostgreSQL for historical data (optional)

**AI Models:**
- **GPT-4**: Recommendation reasoning and text generation
- **Claude 3**: Fast structured output for deal scoring
- **Time Series Model**: ARIMA or LSTM for price prediction
- **Collaborative Filtering**: For personalization

**Data Sources:**
- Agent 1 (Misc Agent): Price history, competitor prices
- Agent 2 (Review Intelligence): Review insights, sentiment
- Chrome Storage: User preferences, browsing history
- External APIs: Sale calendars, market trends (optional)

---

## 🧮 Recommendation Logic

### **Decision Tree**

```
START
  │
  ├─ Fetch Data
  │   ├─ Current price
  │   ├─ Price history (Agent 1)
  │   ├─ Competitor prices (Agent 1)
  │   ├─ Review insights (Agent 2)
  │   └─ User preferences
  │
  ├─ Calculate Scores
  │   ├─ Price Score (0-10)
  │   ├─ Review Score (0-10)
  │   ├─ Trend Score (0-10)
  │   └─ Deal Score (0-10)
  │
  ├─ Predict Future
  │   ├─ Price prediction (30 days)
  │   ├─ Sale event detection
  │   └─ Stock availability forecast
  │
  ├─ Generate Recommendation
  │   ├─ If dealScore >= 7 → BUY NOW
  │   ├─ If dealScore 4-6 AND prediction shows drop → WAIT
  │   ├─ If dealScore < 4 OR reviews poor → AVOID
  │   └─ Generate reasoning text
  │
  ├─ Find Alternatives
  │   ├─ Search similar products
  │   ├─ Compare deal scores
  │   └─ Rank by value
  │
  └─ Personalize
      ├─ Adjust for user budget
      ├─ Factor in preferences
      └─ Add custom insights
```

### **Scoring Algorithms**

**1. Price Score (0-10)**
```javascript
function calculatePriceScore(currentPrice, historicalAvg, lowestPrice) {
  const avgDiff = ((historicalAvg - currentPrice) / historicalAvg) * 100;
  const lowDiff = ((currentPrice - lowestPrice) / lowestPrice) * 100;
  
  if (avgDiff >= 15) return 10;  // 15%+ below average
  if (avgDiff >= 10) return 9;   // 10-15% below average
  if (avgDiff >= 5) return 7;    // 5-10% below average
  if (avgDiff >= 0) return 5;    // At or slightly below average
  if (avgDiff >= -5) return 3;   // Slightly above average
  return 1;                       // Significantly overpriced
}
```

**2. Review Score (0-10)**
```javascript
function calculateReviewScore(rating, reviewCount, sentiment, fakeScore) {
  const ratingScore = (rating / 5) * 10;
  const volumeBonus = Math.min(reviewCount / 1000, 1) * 2;
  const sentimentBonus = sentiment > 0.7 ? 1 : 0;
  const fakePenalty = fakeScore > 0.3 ? -2 : 0;
  
  return Math.max(0, Math.min(10, 
    ratingScore + volumeBonus + sentimentBonus + fakePenalty
  ));
}
```

**3. Trend Score (0-10)**
```javascript
function calculateTrendScore(priceHistory) {
  const recentTrend = analyzeTrend(priceHistory.slice(-10));
  
  if (recentTrend === 'declining') return 8;  // Price dropping
  if (recentTrend === 'stable') return 5;     // Price stable
  if (recentTrend === 'rising') return 2;     // Price increasing
}
```

**4. Overall Deal Score**
```javascript
function calculateDealScore(priceScore, reviewScore, trendScore, competitorScore) {
  return (
    priceScore * 0.40 +
    competitorScore * 0.25 +
    reviewScore * 0.20 +
    trendScore * 0.10 +
    urgencyScore * 0.05
  );
}
```

### **Recommendation Rules**

```javascript
function generateRecommendation(dealScore, prediction, reviewInsights) {
  // BUY NOW conditions
  if (dealScore >= 8 && reviewInsights.sentiment > 0.7) {
    return {
      action: 'BUY',
      confidence: 90 + (dealScore - 8) * 5,
      reasoning: 'Excellent deal with great reviews'
    };
  }
  
  // WAIT conditions
  if (dealScore >= 5 && prediction.dropProbability > 0.6) {
    return {
      action: 'WAIT',
      confidence: 70 + prediction.confidence * 0.2,
      reasoning: `Price likely to drop ${prediction.expectedDrop}% in ${prediction.timeframe}`
    };
  }
  
  // AVOID conditions
  if (dealScore < 4 || reviewInsights.sentiment < 0.4) {
    return {
      action: 'AVOID',
      confidence: 85,
      reasoning: dealScore < 4 ? 'Overpriced' : 'Poor reviews'
    };
  }
  
  // Default: Neutral
  return {
    action: 'WAIT',
    confidence: 60,
    reasoning: 'Average deal, consider waiting for better price'
  };
}
```

---

## 📅 Implementation Plan

### **Phase 1: Core Recommendation Engine (Week 1-2)**

**Week 1: Scoring System**
- [ ] Implement price score calculation
- [ ] Implement review score calculation
- [ ] Implement trend score calculation
- [ ] Implement deal score aggregation
- [ ] Unit tests for all scoring functions

**Week 2: Recommendation Logic**
- [ ] Build decision tree
- [ ] Implement BUY/WAIT/AVOID logic
- [ ] Generate reasoning text
- [ ] Calculate confidence scores
- [ ] Integration tests

**Deliverables:**
- ✅ Working scoring system
- ✅ Basic recommendations (BUY/WAIT/AVOID)
- ✅ Confidence scores
- ✅ Clear reasoning

### **Phase 2: Price Prediction (Week 3)**

**Tasks:**
- [ ] Collect historical price data
- [ ] Build time series model (ARIMA or LSTM)
- [ ] Train on historical data
- [ ] Implement prediction API
- [ ] Add sale event detection
- [ ] Calculate prediction confidence

**Deliverables:**
- ✅ 30-day price predictions
- ✅ Sale event detection
- ✅ Best time to buy suggestions

### **Phase 3: Alternative Finder (Week 4)**

**Tasks:**
- [ ] Build product similarity algorithm
- [ ] Implement alternative search
- [ ] Compare deal scores
- [ ] Rank alternatives by value
- [ ] Generate comparison UI

**Deliverables:**
- ✅ Alternative product suggestions
- ✅ Feature comparison
- ✅ Value ranking

### **Phase 4: Personalization (Week 5)**

**Tasks:**
- [ ] Track user browsing history
- [ ] Analyze user preferences
- [ ] Build user profile
- [ ] Implement personalized scoring
- [ ] Generate custom insights

**Deliverables:**
- ✅ User preference tracking
- ✅ Personalized recommendations
- ✅ Budget-aware suggestions
- ✅ Custom insights

### **Phase 5: Integration & Polish (Week 6)**

**Tasks:**
- [ ] Integrate with extension
- [ ] Build recommendation UI
- [ ] Add loading states
- [ ] Error handling
- [ ] User testing
- [ ] Performance optimization

**Deliverables:**
- ✅ Full integration with Picksy
- ✅ Polished UI
- ✅ Production-ready

---

## 🔌 API Specifications

### **Endpoint: Get Recommendation**

```javascript
POST /api/recommendation

Request:
{
  "product": {
    "id": "amazon_B0CHWV2WYK",
    "title": "iPhone 15 Pro 128GB",
    "currentPrice": 48990,
    "currency": "INR",
    "url": "https://amazon.in/..."
  },
  "priceHistory": [
    { "price": 51990, "timestamp": 1234567890 },
    { "price": 50990, "timestamp": 1234654290 }
  ],
  "competitorPrices": [
    { "site": "Flipkart", "price": 49990 },
    { "site": "Croma", "price": 50990 }
  ],
  "reviewInsights": {
    "rating": 4.5,
    "reviewCount": 2300,
    "sentiment": 0.82,
    "fakeScore": 0.15
  },
  "userPreferences": {
    "budget": { "min": 40000, "max": 60000 },
    "brands": ["Apple", "Samsung"],
    "features": ["camera", "battery"]
  }
}

Response:
{
  "success": true,
  "recommendation": {
    "action": "BUY",  // BUY, WAIT, or AVOID
    "confidence": 92,
    "reasoning": "Excellent deal! Price is 15% below 3-month average...",
    "dealScore": 8.5,
    "scores": {
      "price": 9.0,
      "review": 8.5,
      "trend": 7.0,
      "competitor": 8.0
    }
  },
  "prediction": {
    "nextPrice": 47500,
    "timeframe": "30 days",
    "dropProbability": 0.35,
    "confidence": 75
  },
  "bestTimeToBuy": {
    "date": "2025-12-15",
    "expectedPrice": 46990,
    "reason": "Year-end sale"
  },
  "alternatives": [
    {
      "title": "Samsung Galaxy S24",
      "price": 44990,
      "dealScore": 9.0,
      "url": "https://amazon.in/...",
      "advantages": ["12% cheaper", "Better camera"],
      "disadvantages": ["Slightly heavier"]
    }
  ],
  "personalizedInsights": [
    "This fits your budget range",
    "Wait for sale to save ₹2,000"
  ]
}
```

---

## 🎨 UI/UX Design

### **Recommendation Card**

```
┌─────────────────────────────────────────────┐
│  🤖 AI Recommendation                       │
├─────────────────────────────────────────────┤
│                                             │
│  🟢 BUY NOW                                 │
│  Confidence: 92%                            │
│                                             │
│  "Excellent deal! Price is 15% below        │
│  3-month average and reviews are            │
│  outstanding (4.5/5 from 2,300 reviews)."   │
│                                             │
│  📊 Deal Score: 8.5/10 (Great Deal!)        │
│                                             │
│  ✅ Price: 15% below average                │
│  ✅ Reviews: Excellent (4.5/5)              │
│  ✅ Trend: Stable                           │
│  ✅ vs Competitors: Best price              │
│                                             │
│  [View Details] [Find Alternatives]         │
│                                             │
└─────────────────────────────────────────────┘
```

### **Price Prediction Card**

```
┌─────────────────────────────────────────────┐
│  📈 Price Prediction (Next 30 Days)         │
├─────────────────────────────────────────────┤
│                                             │
│  Current: ₹48,990                           │
│  Predicted: ₹46,500 - ₹49,500              │
│  Confidence: 75%                            │
│                                             │
│  📊 Probability:                            │
│  ████████████░░░░░░░░ 60% Drop 3-5%        │
│  ██████░░░░░░░░░░░░░░ 30% Stay stable      │
│  ██░░░░░░░░░░░░░░░░░░ 10% Increase         │
│                                             │
│  💡 Wait 2-3 weeks for ₹2,000 savings       │
│                                             │
└─────────────────────────────────────────────┘
```

### **Alternatives Card**

```
┌─────────────────────────────────────────────┐
│  💡 Better Alternatives (2 found)           │
├─────────────────────────────────────────────┤
│                                             │
│  1. Samsung Galaxy S24 - ₹44,990           │
│     Deal Score: 9.0/10                      │
│     ✅ 12% cheaper                          │
│     ✅ Better camera (4.7/5 vs 4.3/5)       │
│     ⚠️  Slightly heavier                    │
│     [View Product]                          │
│                                             │
│  2. OnePlus 12 - ₹46,990                   │
│     Deal Score: 8.7/10                      │
│     ✅ 4% cheaper                           │
│     ✅ Faster charging                      │
│     [View Product]                          │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 📊 Success Metrics

### **Technical Metrics**

- **Recommendation Accuracy**: 85%+ (user agrees with recommendation)
- **Prediction Accuracy**: 70%+ (price prediction within 10%)
- **Response Time**: <2 seconds for recommendation
- **Confidence Calibration**: Confidence score matches actual accuracy

### **User Metrics**

- **Feature Usage**: 80%+ of users check recommendations
- **Money Saved**: Average ₹500-1000 per purchase
- **User Satisfaction**: 4.5+ stars
- **Trust Score**: 85%+ users trust recommendations

### **Business Metrics**

- **Engagement**: 3x increase in extension usage
- **Retention**: 60%+ weekly active users
- **Conversion**: 40%+ users act on recommendations

---

## 🚀 Future Enhancements

### **Phase 2 Features**

- **Voice Recommendations**: "Should I buy this?"
- **Image-Based Matching**: Find alternatives by photo
- **Price Alerts**: Notify when recommendation changes
- **Comparison Mode**: Compare 2-3 products side-by-side
- **Budget Planner**: Track spending and savings

### **Advanced AI**

- **Deep Learning**: More accurate price predictions
- **Reinforcement Learning**: Learn from user feedback
- **Multi-Modal AI**: Analyze product images + text
- **Explainable AI**: Better reasoning transparency

---

## 💰 Cost Estimation

### **For 1000 Users (10 recommendations/user/month)**

**AI Costs:**
- GPT-4: $0.03/recommendation × 10,000 = $300/month
- Claude 3: $0.02/recommendation × 10,000 = $200/month
- Time Series Model: FREE (self-hosted)

**Infrastructure:**
- Backend hosting: $20-50/month
- Database: $10-20/month
- Redis cache: $10/month

**Total: $240-380/month ($0.24-0.38 per user)**

---

## 📚 Documentation

### **For Developers**

- API documentation (OpenAPI/Swagger)
- Algorithm explanations
- Code comments
- Unit test coverage

### **For Users**

- How recommendations work
- What confidence scores mean
- How to provide feedback
- Privacy and data usage

---

**Made with 🧠 for smart shoppers**

*Last Updated: November 30, 2025*  
*Version: 0.4.0 (Planned)*  
*Status: Design complete, ready for implementation*
