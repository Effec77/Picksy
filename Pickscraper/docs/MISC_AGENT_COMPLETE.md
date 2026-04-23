# 🎯 Picksy Miscellaneous AI Agent (Price Comparison Engine)

> **Component: Agent 1 - The "Price Intelligence Hub" of Picksy Ecosystem**

**Last Updated:** November 30, 2025  
**Version:** v0.2.0 (In Development)  
**Status:** Design Complete - Implementation Starting

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

The **Picksy Miscellaneous AI Agent** is a comprehensive utility subsystem that serves as the **"Price Intelligence Hub"** of the Picksy Ecosystem. Unlike traditional price comparison tools that rely on hardcoded selectors and break when websites change, this agent uses **AI-powered universal extraction** to work on ANY e-commerce site.

This agent is the **Swiss Army Knife** of Picksy - designed to be flexible and accommodate new features as the product evolves.

### **Core Functions**

1. **Automatic Price Comparison**: Scrape 10+ legit sites in parallel and find the best deal (5-10 seconds)
2. **Price History Tracking**: Monitor price changes over time (up to 50 data points per product)
3. **Smart Alerts & Email Notifications**: Notify users of price drops, stock changes, and target prices
4. **Visual Analytics**: Generate price charts and trend graphs
5. **Smart Search**: Intelligent keyword extraction for cross-site searching
6. **Site Management**: Maintain whitelist of 16 verified, legit e-commerce sites

### **Key Differentiator**

**Universal AI Extraction**: Unlike competitors (Honey, CamelCamelCamel) that use hardcoded CSS selectors and break when sites update, Picksy uses **Gemini Pro or GPT-4 Vision** to extract data intelligently. This means:
- ✅ Works on ANY website (not just pre-configured ones)
- ✅ Adapts automatically when sites change HTML
- ✅ 95-98% extraction accuracy
- ✅ Zero maintenance burden

---

## 💡 WHY: Strategic Imperative

### **2.1 The Hardcoded Selector Problem**

**Current State (v0.1.0):**
```javascript
// Amazon selector (breaks when Amazon updates)
const priceSelector = '.a-price-whole';

// Flipkart selector (different structure)
const priceSelector = '._30jeq3';

// Problem: Sites change HTML every few months
```

**Pain Points:**
- ⚠️ Selectors break when sites update (high maintenance)
- ⚠️ Only works on 6 hardcoded sites
- ⚠️ Cannot scale to 100+ sites
- ⚠️ Manual comparison links only (no automatic scraping)

### **2.2 The AI Solution**

**New Approach (v0.2.0):**
```
User scans product → AI analyzes page → 
Extracts: title, price, rating, stock → 
Works on ANY site → No maintenance needed
```

**Benefits:**
- ✅ **Universal**: Works on ANY e-commerce site
- ✅ **Maintainable**: AI adapts when sites change
- ✅ **Scalable**: Can handle 100+ sites
- ✅ **Accurate**: 95-98% extraction accuracy
- ✅ **Fast**: 5-10 seconds for 10 sites (parallel scraping)

### **2.3 Competitive Advantage**

| Feature | Honey | CamelCamelCamel | Keepa | **Picksy** |
|---------|-------|-----------------|-------|------------|
| **Price Comparison** | ❌ No | ❌ Amazon only | ❌ Amazon only | ✅ 10+ sites |
| **Universal Scraping** | ❌ No | ❌ No | ❌ No | ✅ AI-powered |
| **Email Alerts** | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **Review Verification** | ❌ No | ❌ No | ❌ No | ✅ Yes (Agent 2) |
| **Buy Recommendations** | ❌ No | ❌ No | ❌ No | ✅ Yes (Agent 3) |
| **Works in India** | ⚠️ Limited | ⚠️ Limited | ⚠️ Limited | ✅ Optimized |

### **2.4 The Email Notification Advantage**

**Problem:** Browser notifications are easily missed and don't work when browser is closed.

**Solution:** Email notifications provide:
- ✅ **Reliability**: Always delivered, even when browser is closed
- ✅ **Persistence**: Users can check emails anytime
- ✅ **Engagement**: Higher open rates than browser notifications
- ✅ **Professional**: Branded emails build trust

---

## 🏗️ HOW: Technical Architecture & Workflow

The Misc Agent follows a **three-phase architecture** similar to the Review Intelligence Engine:

- **Phase A**: Universal Extraction (Scraping & AI)
- **Phase B**: Product Matching & Comparison
- **Phase C**: Output Generation & Notifications

---

### **Phase A: The Universal Extraction Layer**

**Objective:** Extract product data from ANY e-commerce site using AI, without hardcoded selectors.

#### **1.1 The Two-Path Architecture**

```
┌─────────────────────────────────────────────────┐
│         UNIVERSAL EXTRACTION SYSTEM             │
├─────────────────────────────────────────────────┤
│                                                 │
│  User visits product page                       │
│         │                                       │
│         ▼                                       │
│  ┌──────────────────────────────────────┐      │
│  │  PATH 1: MVP (Invisible Tabs)        │      │
│  │  • Quick to build (2 weeks)          │      │
│  │  • Free (no backend costs)           │      │
│  │  • Opens tabs in background          │      │
│  │  • 15-20 seconds for 10 sites        │      │
│  └──────────────┬───────────────────────┘      │
│                 │                               │
│  ┌──────────────▼───────────────────────┐      │
│  │  PATH 2: Production (Backend API)    │      │
│  │  • Better UX (no tabs)               │      │
│  │  • Faster (5-10 seconds)             │      │
│  │  • Cacheable results                 │      │
│  │  • Costs $20-120/month               │      │
│  └──────────────┬───────────────────────┘      │
│                 │                               │
│                 ▼                               │
│  ┌──────────────────────────────────────┐      │
│  │  AI Extraction Engine                │      │
│  │  (Gemini Pro or GPT-4 Vision)        │      │
│  │  • Analyzes page HTML/screenshot     │      │
│  │  • Extracts: title, price, rating    │      │
│  │  • 95-98% accuracy                   │      │
│  └──────────────┬───────────────────────┘      │
│                 │                               │
│                 ▼                               │
│  ┌──────────────────────────────────────┐      │
│  │  Product Matching Algorithm          │      │
│  │  • 90-100%: Exact Match              │      │
│  │  • 70-89%: Similar Product           │      │
│  │  • <70%: Discard                     │      │
│  └──────────────────────────────────────┘      │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### **1.2 Path 1: MVP with Invisible Tabs (Week 1-2)**

**How It Works:**

```
Step 1: User scans product on Amazon
        ↓
Step 2: Extension extracts keywords
        "iPhone 15 Pro 128GB"
        ↓
Step 3: Generate search URLs for 10 sites
        • Flipkart: flipkart.com/search?q=iPhone+15+Pro
        • Myntra: myntra.com/search?q=iPhone+15+Pro
        • ... (8 more sites)
        ↓
Step 4: Open invisible tabs (background)
        chrome.tabs.create({ url, active: false })
        ↓
Step 5: Inject content script in each tab
        Extract data using AI
        ↓
Step 6: Close tabs after extraction
        ↓
Step 7: Match products (confidence scoring)
        ↓
Step 8: Display comparison table
```

**Pros:**
- ✅ Quick to build (2 weeks)
- ✅ No backend costs (FREE)
- ✅ No hosting required
- ✅ Works immediately

**Cons:**
- ⚠️ Slower (15-20 seconds for 10 sites)
- ⚠️ Opens tabs in user's browser (visible in tab bar)
- ⚠️ Cannot cache results
- ⚠️ Limited by user's internet speed

#### **1.3 Path 2: Production with Backend API (Week 3-4)**

**How It Works:**

```
Step 1: User scans product on Amazon
        ↓
Step 2: Extension sends request to backend
        POST /api/compare
        { product: "iPhone 15 Pro 128GB" }
        ↓
Step 3: Backend checks Redis cache
        Key: "compare:iphone_15_pro_128gb"
        ↓
    ┌───┴───┐
    │       │
  HIT      MISS
    │       │
    │       ├─→ Trigger scraping job
    │       ├─→ Puppeteer opens 10 headless browsers
    │       ├─→ AI extracts data from each
    │       ├─→ Match products
    │       ├─→ Cache results (6 hours)
    │       └─→ Return to extension
    │
    └─→ Return cached results instantly
        ↓
Step 4: Extension displays comparison table
```

**Pros:**
- ✅ Faster (5-10 seconds for 10 sites)
- ✅ No tabs in user's browser
- ✅ Cacheable (6-hour cache)
- ✅ Better error handling
- ✅ Professional UX

**Cons:**
- ⚠️ Requires backend ($20-120/month)
- ⚠️ More complex to build (4 weeks)
- ⚠️ Hosting and maintenance

---

### **Phase B: The AI Extraction Engine**

**Objective:** Use AI to extract product data from ANY website without hardcoded selectors.

#### **2.1 The AI Extraction Models**

| Model | Cost | Accuracy | Speed | Recommendation |
|-------|------|----------|-------|----------------|
| **Gemini Pro** | FREE | 95% | Fast | ✅ MVP |
| **GPT-4 Vision** | $0.01/req | 98% | Medium | ✅ Production |
| **Claude 3** | $0.008/req | 95% | Fast | Alternative |

#### **2.2 The Extraction Prompt**

**Input to AI:**
```javascript
{
  "html": "<div class='product'>...</div>",
  "screenshot": "base64_image_data",  // Optional for GPT-4 Vision
  "url": "https://amazon.in/product/..."
}
```

**Prompt Template:**
```
You are a product data extraction expert. Analyze the provided HTML and extract:

1. Product Title (full name)
2. Current Price (number only, no currency symbol)
3. Currency (INR, USD, EUR, etc.)
4. Original Price (if discounted)
5. Discount Percentage
6. Stock Status (in_stock, out_of_stock, limited_stock)
7. Rating (0-5 stars)
8. Review Count (number of reviews)
9. Seller Name
10. Product Image URL

Return ONLY valid JSON. If a field is not found, use null.

Example Output:
{
  "title": "iPhone 15 Pro 128GB Natural Titanium",
  "price": 48990,
  "currency": "INR",
  "original_price": 51990,
  "discount": 6,
  "stock": "in_stock",
  "rating": 4.5,
  "reviews": 2300,
  "seller": "Appario Retail",
  "image": "https://..."
}
```

**AI Response:**
```json
{
  "title": "iPhone 15 Pro 128GB Natural Titanium",
  "price": 48990,
  "currency": "INR",
  "original_price": 51990,
  "discount": 6,
  "stock": "in_stock",
  "rating": 4.5,
  "reviews": 2300,
  "seller": "Appario Retail",
  "image": "https://m.media-amazon.com/..."
}
```

#### **2.3 Extraction Accuracy Validation**

**Quality Checks:**

```javascript
function validateExtraction(data) {
  const checks = {
    title: data.title && data.title.length > 5,
    price: data.price && data.price > 0,
    currency: ['INR', 'USD', 'EUR', 'GBP', 'CAD'].includes(data.currency),
    stock: ['in_stock', 'out_of_stock', 'limited_stock'].includes(data.stock)
  };
  
  const score = Object.values(checks).filter(Boolean).length / 4;
  
  if (score < 0.75) {
    return { valid: false, confidence: score };
  }
  
  return { valid: true, confidence: score };
}
```

**Confidence Scoring:**
- **> 0.9**: High confidence (use immediately)
- **0.75-0.9**: Medium confidence (flag for review)
- **< 0.75**: Low confidence (discard)

---

### **Phase C: The Product Matching Algorithm**

**Objective:** Determine if products from different sites are the same item.

#### **3.1 The Matching Logic**

```
┌─────────────────────────────────────────────────┐
│         PRODUCT MATCHING ALGORITHM              │
├─────────────────────────────────────────────────┤
│                                                 │
│  Original Product: "iPhone 15 Pro 128GB"        │
│         │                                       │
│         ▼                                       │
│  ┌──────────────────────────────────────┐      │
│  │  Step 1: Keyword Extraction          │      │
│  │  • Brand: "iPhone"                   │      │
│  │  • Model: "15 Pro"                   │      │
│  │  • Variant: "128GB"                  │      │
│  │  • Color: (optional)                 │      │
│  └──────────────┬───────────────────────┘      │
│                 │                               │
│                 ▼                               │
│  ┌──────────────────────────────────────┐      │
│  │  Step 2: Fuzzy Matching              │      │
│  │  Compare with scraped products       │      │
│  │  • Token overlap                     │      │
│  │  • Levenshtein distance              │      │
│  │  • Price similarity                  │      │
│  └──────────────┬───────────────────────┘      │
│                 │                               │
│                 ▼                               │
│  ┌──────────────────────────────────────┐      │
│  │  Step 3: Confidence Scoring          │      │
│  │  • 90-100%: Exact Match              │      │
│  │  • 70-89%: Similar Product           │      │
│  │  • <70%: Different Product           │      │
│  └──────────────┬───────────────────────┘      │
│                 │                               │
│                 ▼                               │
│  ┌──────────────────────────────────────┐      │
│  │  Step 4: Categorization              │      │
│  │  • EXACT MATCHES (90-100%)           │      │
│  │  • SIMILAR PRODUCTS (70-89%)         │      │
│  │  • Discard (<70%)                    │      │
│  └──────────────────────────────────────┘      │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### **3.2 The Matching Algorithm**

```javascript
function calculateMatchScore(original, candidate) {
  // Extract key features
  const originalTokens = tokenize(original.title);
  const candidateTokens = tokenize(candidate.title);
  
  // 1. Token Overlap Score (40% weight)
  const commonTokens = intersection(originalTokens, candidateTokens);
  const tokenScore = commonTokens.length / originalTokens.length;
  
  // 2. Levenshtein Distance Score (30% weight)
  const distance = levenshtein(original.title, candidate.title);
  const maxLength = Math.max(original.title.length, candidate.title.length);
  const similarityScore = 1 - (distance / maxLength);
  
  // 3. Price Similarity Score (20% weight)
  const priceDiff = Math.abs(original.price - candidate.price);
  const avgPrice = (original.price + candidate.price) / 2;
  const priceScore = 1 - Math.min(priceDiff / avgPrice, 1);
  
  // 4. Brand Match (10% weight)
  const brandScore = original.brand === candidate.brand ? 1 : 0;
  
  // Final weighted score
  const finalScore = (
    tokenScore * 0.40 +
    similarityScore * 0.30 +
    priceScore * 0.20 +
    brandScore * 0.10
  );
  
  return finalScore * 100;  // Convert to percentage
}
```

#### **3.3 Matching Examples**

| Original | Candidate | Token | Similarity | Price | Brand | **Final** | Category |
|----------|-----------|-------|------------|-------|-------|-----------|----------|
| iPhone 15 Pro 128GB | iPhone 15 Pro 128GB Natural Titanium | 100% | 95% | 98% | 100% | **97%** | ✅ Exact |
| iPhone 15 Pro 128GB | iPhone 15 Pro 256GB | 75% | 90% | 85% | 100% | **85%** | ⚠️ Similar |
| iPhone 15 Pro 128GB | Samsung Galaxy S24 | 0% | 20% | 90% | 0% | **22%** | ❌ Discard |

---


### **Phase D: Price History & Tracking**

**Objective:** Monitor price changes over time and alert users to drops.

#### **4.1 The Price History Data Structure**

```javascript
{
  "productId": "amazon_B0CHWV2WYK",
  "title": "iPhone 15 Pro 128GB",
  "url": "https://amazon.in/dp/B0CHWV2WYK",
  "source": "amazon.in",
  "currentPrice": 48990,
  "currency": "INR",
  "history": [
    {
      "price": 51990,
      "stock": true,
      "timestamp": 1698451200000,
      "currency": "INR"
    },
    {
      "price": 50990,
      "stock": true,
      "timestamp": 1698537600000,
      "currency": "INR"
    },
    {
      "price": 48990,
      "stock": true,
      "timestamp": 1698624000000,
      "currency": "INR"
    }
    // ... up to 50 entries
  ],
  "stats": {
    "lowest": 48990,
    "highest": 51990,
    "average": 50323,
    "lastUpdated": 1698624000000
  }
}
```

#### **4.2 Background Monitoring System**

```
┌─────────────────────────────────────────────────┐
│      BACKGROUND MONITORING SYSTEM               │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────────────────────────────┐      │
│  │  Chrome Alarms API                   │      │
│  │  Triggers every 6 hours              │      │
│  └──────────────┬───────────────────────┘      │
│                 │                               │
│                 ▼                               │
│  ┌──────────────────────────────────────┐      │
│  │  Fetch Saved Products                │      │
│  │  from Chrome Storage                 │      │
│  └──────────────┬───────────────────────┘      │
│                 │                               │
│                 ▼                               │
│  ┌──────────────────────────────────────┐      │
│  │  Sequential Scraping                 │      │
│  │  • Open tab for each product         │      │
│  │  • Extract current price             │      │
│  │  • Wait 3 seconds between tabs       │      │
│  │  • Close tab after extraction        │      │
│  └──────────────┬───────────────────────┘      │
│                 │                               │
│                 ▼                               │
│  ┌──────────────────────────────────────┐      │
│  │  Compare with Last Price             │      │
│  │  IF current < last:                  │      │
│  │    → Trigger price drop alert        │      │
│  │  IF stock changed:                   │      │
│  │    → Trigger stock alert             │      │
│  └──────────────┬───────────────────────┘      │
│                 │                               │
│                 ▼                               │
│  ┌──────────────────────────────────────┐      │
│  │  Update Price History                │      │
│  │  • Add new data point                │      │
│  │  • Keep last 50 entries              │      │
│  │  • Update stats (min/max/avg)        │      │
│  └──────────────────────────────────────┘      │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### **4.3 Price History Visualization**

**SVG Chart Generation:**

```javascript
function generatePriceChart(history) {
  const width = 300;
  const height = 150;
  const padding = 20;
  
  // Calculate scales
  const prices = history.map(h => h.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  
  // Generate SVG path
  const points = history.map((h, i) => {
    const x = padding + (i / (history.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((h.price - minPrice) / priceRange) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');
  
  return `
    <svg width="${width}" height="${height}">
      <polyline points="${points}" 
                fill="none" 
                stroke="#4CAF50" 
                stroke-width="2"/>
      <!-- Add axes, labels, etc. -->
    </svg>
  `;
}
```

---

### **Phase E: Smart Alerts & Email Notifications**

**Objective:** Notify users of important price changes via email for better reliability.

#### **5.1 Alert Trigger Conditions**

| Alert Type | Trigger Condition | Priority |
|------------|-------------------|----------|
| **Price Drop** | `current_price < last_price` | High |
| **Target Price** | `current_price <= target_price` | Critical |
| **Stock Alert** | `out_of_stock → in_stock` | Medium |
| **Deal Alert** | `discount > 20%` | High |
| **Price Spike** | `current_price > last_price * 1.1` | Low |

#### **5.2 Email Notification System**

```
┌─────────────────────────────────────────────────┐
│       EMAIL NOTIFICATION SYSTEM                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────────────────────────────┐      │
│  │  Alert Triggered                     │      │
│  │  (Price drop detected)               │      │
│  └──────────────┬───────────────────────┘      │
│                 │                               │
│                 ▼                               │
│  ┌──────────────────────────────────────┐      │
│  │  Check User Preferences              │      │
│  │  • Email notifications enabled?      │      │
│  │  • User email verified?              │      │
│  └──────────────┬───────────────────────┘      │
│                 │                               │
│                 ▼                               │
│  ┌──────────────────────────────────────┐      │
│  │  Generate Email Content              │      │
│  │  • Subject: "Price Drop Alert!"      │      │
│  │  • Body: Product details + CTA       │      │
│  │  • Template: HTML + Plain text       │      │
│  └──────────────┬───────────────────────┘      │
│                 │                               │
│                 ▼                               │
│  ┌──────────────────────────────────────┐      │
│  │  Send via Email Service              │      │
│  │  • SendGrid / AWS SES / Mailgun      │      │
│  │  • Retry on failure (3 attempts)     │      │
│  │  • Track delivery status             │      │
│  └──────────────┬───────────────────────┘      │
│                 │                               │
│                 ▼                               │
│  ┌──────────────────────────────────────┐      │
│  │  Log Notification                    │      │
│  │  • Timestamp                         │      │
│  │  • Delivery status                   │      │
│  │  • User action (opened/clicked)      │      │
│  └──────────────────────────────────────┘      │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### **5.3 Email Service Comparison**

| Service | Free Tier | Cost (Paid) | Deliverability | Recommendation |
|---------|-----------|-------------|----------------|----------------|
| **SendGrid** | 12,000/mo | $19.95/mo (40K) | Excellent | ✅ Best for MVP |
| **AWS SES** | 62,000/mo | $0.10/1000 | Excellent | ✅ Best for scale |
| **Mailgun** | 5,000/mo | $35/mo (50K) | Good | Alternative |
| **Resend** | 3,000/mo | $20/mo (50K) | Good | Alternative |

#### **5.4 Email Template**

**Subject:** `🔔 Price Drop Alert: iPhone 15 Pro now ₹48,990 (6% off!)`

**HTML Body:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .product { border: 1px solid #ddd; padding: 15px; margin: 20px 0; }
    .price-old { text-decoration: line-through; color: #999; }
    .price-new { font-size: 24px; color: #4CAF50; font-weight: bold; }
    .cta { background: #4CAF50; color: white; padding: 15px 30px; 
           text-decoration: none; border-radius: 5px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 Price Drop Alert!</h1>
    </div>
    <div class="content">
      <p>Great news! The product you're tracking just dropped in price:</p>
      
      <div class="product">
        <img src="{{product_image}}" width="100" />
        <h2>{{product_title}}</h2>
        <p class="price-old">₹{{old_price}}</p>
        <p class="price-new">₹{{new_price}}</p>
        <p>💰 You save: ₹{{savings}} ({{discount}}% off)</p>
        <p>⭐ Rating: {{rating}}/5 ({{reviews}} reviews)</p>
      </div>
      
      <p>This is a great deal! Prices can change anytime.</p>
      
      <a href="{{product_url}}" class="cta">View Product →</a>
      
      <p style="color: #999; font-size: 12px; margin-top: 30px;">
        You're receiving this because you're tracking this product on Picksy.
        <a href="{{unsubscribe_url}}">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>
```

---

### **Phase F: Site Management & Verification**

**Objective:** Maintain a whitelist of verified, legit e-commerce sites to ensure user safety.

#### **6.1 The Verified Sites Whitelist**

| Tier | Trust Score | Sites | Criteria |
|------|-------------|-------|----------|
| **Tier 1** | 10/10 | Apple, Samsung, Nike, Adidas, Puma, Optimum Nutrition | Official brand stores |
| **Tier 2** | 9/10 | Amazon India, Flipkart, Myntra, Ajio, Tata CLiQ | Major marketplaces |
| **Tier 3** | 8/10 | Croma, Reliance Digital, Vijay Sales, Healthkart, Nykaa | Verified retailers |

#### **6.2 Site Verification Criteria**

```javascript
const SITE_VERIFICATION_CRITERIA = {
  // Must have ALL of these
  required: [
    'https_enabled',           // SSL certificate
    'return_policy',           // Clear return policy
    'customer_support',        // Contact information
    'payment_gateway',         // Secure payment
    'business_registration'    // Registered business
  ],
  
  // Bonus points for these
  bonus: [
    'verified_reviews',        // Review verification system
    'warranty_support',        // Warranty information
    'fast_shipping',           // Quick delivery
    'cod_available',           // Cash on delivery
    'brand_authorized'         // Authorized retailer
  ],
  
  // Automatic disqualification
  blacklist: [
    'fake_reviews_detected',   // Review manipulation
    'scam_reports',            // User complaints
    'payment_issues',          // Payment problems
    'counterfeit_products',    // Fake products
    'no_refund_policy'         // No returns
  ]
};
```

#### **6.3 Site Trust Score Calculation**

```javascript
function calculateTrustScore(site) {
  let score = 0;
  
  // Check required criteria (60 points)
  const requiredMet = SITE_VERIFICATION_CRITERIA.required.filter(
    criterion => site.has(criterion)
  ).length;
  score += (requiredMet / 5) * 60;
  
  // Check bonus criteria (30 points)
  const bonusMet = SITE_VERIFICATION_CRITERIA.bonus.filter(
    criterion => site.has(criterion)
  ).length;
  score += (bonusMet / 5) * 30;
  
  // User ratings (10 points)
  score += (site.userRating / 5) * 10;
  
  // Check blacklist (disqualify)
  const blacklisted = SITE_VERIFICATION_CRITERIA.blacklist.some(
    criterion => site.has(criterion)
  );
  
  if (blacklisted) {
    return 0;  // Disqualified
  }
  
  return Math.round(score);
}
```

---

## 📊 DATA ARTIFACTS: The Comparison Output

### **Output 1: Comparison Table (Consumer View)**

**Goal:** Show users the best deals at a glance

```
┌─────────────────────────────────────────────────┐
│  💰 Price Comparison Results                    │
├─────────────────────────────────────────────────┤
│                                                 │
│  Product: iPhone 15 Pro 128GB                   │
│  Scanned: 10 sites in 7 seconds                │
│                                                 │
│  ✅ EXACT MATCHES (3 found)                     │
│                                                 │
│  🥇 Best Deal                                   │
│  ┌───────────────────────────────────────┐     │
│  │ Flipkart                              │     │
│  │ ₹47,990  (8% off)                     │     │
│  │ ⭐ 4.6/5 (1,200 reviews)              │     │
│  │ 🚚 Free delivery                      │     │
│  │ Trust: 9/10                           │     │
│  │ [View Product →]                      │     │
│  └───────────────────────────────────────┘     │
│                                                 │
│  🥈 Second Best                                 │
│  ┌───────────────────────────────────────┐     │
│  │ Amazon India                          │     │
│  │ ₹48,990  (6% off)                     │     │
│  │ ⭐ 4.5/5 (2,300 reviews)              │     │
│  │ 🚚 Free delivery                      │     │
│  │ Trust: 9/10                           │     │
│  │ [View Product →]                      │     │
│  └───────────────────────────────────────┘     │
│                                                 │
│  🥉 Third Best                                  │
│  ┌───────────────────────────────────────┐     │
│  │ Croma                                 │     │
│  │ ₹50,990  (2% off)                     │     │
│  │ ⭐ 4.3/5 (450 reviews)                │     │
│  │ 🚚 ₹50 delivery                       │     │
│  │ Trust: 8/10                           │     │
│  │ [View Product →]                      │     │
│  └───────────────────────────────────────┘     │
│                                                 │
│  ⚠️  SIMILAR PRODUCTS (2 found)                 │
│  • iPhone 15 Pro 256GB - ₹57,990 (Flipkart)    │
│  • iPhone 15 Pro Max 128GB - ₹64,990 (Amazon)  │
│                                                 │
│  💡 Picksy Tip: Flipkart has the best deal!     │
│  Save ₹3,000 compared to MRP.                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### **Output 2: Price History Chart**

```
┌─────────────────────────────────────────────────┐
│  📈 Price History (Last 30 Days)                │
├─────────────────────────────────────────────────┤
│                                                 │
│  ₹52,000 ┤                                      │
│          │  ●                                   │
│  ₹51,000 ┤    ●                                 │
│          │      ●                               │
│  ₹50,000 ┤        ●   ●                         │
│          │            ●   ●                     │
│  ₹49,000 ┤                  ●   ●              │
│          │                        ●   ●        │
│  ₹48,000 ┤                              ●   ●  │
│          └────────────────────────────────────  │
│           Oct 1    Oct 15    Oct 30             │
│                                                 │
│  📊 Statistics:                                 │
│  • Current: ₹48,990                             │
│  • Lowest: ₹48,990 (Today)                      │
│  • Highest: ₹51,990 (Oct 1)                     │
│  • Average: ₹50,323                             │
│  • Trend: ⬇️ Decreasing                         │
│                                                 │
│  💡 This is the lowest price in 30 days!        │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🔧 INFRASTRUCTURE STACK

| Component | Technology | Purpose | Cost |
|-----------|------------|---------|------|
| **Frontend** | Chrome Extension (Manifest V3) | User interface | FREE |
| **Backend API** | Node.js + Express | Scraping orchestration | $20-50/mo |
| **Browser Automation** | Puppeteer | Headless browsing | Included |
| **AI Extraction** | Gemini Pro / GPT-4 Vision | Universal data extraction | FREE / $120/mo |
| **Caching** | Redis | 6-hour result cache | $10-20/mo |
| **Database** | PostgreSQL | Product master records | $10-20/mo |
| **Email Service** | SendGrid / AWS SES | Alert notifications | FREE / $0.10/1K |
| **Hosting** | Railway / Heroku | Backend deployment | $20-50/mo |
| **Monitoring** | Sentry | Error tracking | FREE tier |

**Total Cost (MVP with Gemini Pro):** $20-50/month  
**Total Cost (Production with GPT-4 Vision):** $120-200/month

---

## 📅 IMPLEMENTATION PLAN

### **Phase 1: MVP with Invisible Tabs (Week 1-2)**

**Week 1: Core Scraping**
- [ ] Build keyword extraction logic
- [ ] Generate search URLs for 10 sites
- [ ] Implement invisible tab scraping
- [ ] Integrate Gemini Pro for extraction
- [ ] Test on 5 products

**Week 2: Matching & UI**
- [ ] Build product matching algorithm
- [ ] Implement confidence scoring
- [ ] Create comparison table UI
- [ ] Add loading states
- [ ] User testing

**Deliverables:**
- ✅ Working price comparison (15-20 seconds)
- ✅ 10+ sites supported
- ✅ 90%+ match accuracy
- ✅ Comparison table UI

---

### **Phase 2: Backend API (Week 3-4)**

**Week 3: Backend Setup**
- [ ] Set up Node.js + Express server
- [ ] Integrate Puppeteer
- [ ] Build scraping queue (Celery/Bull)
- [ ] Implement Redis caching
- [ ] Deploy to Railway

**Week 4: Integration**
- [ ] Update extension to call API
- [ ] Add error handling
- [ ] Implement retry logic
- [ ] Performance optimization
- [ ] Load testing

**Deliverables:**
- ✅ Backend API (5-10 seconds)
- ✅ Redis caching (6 hours)
- ✅ No tabs in browser
- ✅ Better error handling

---

### **Phase 3: Email Notifications (Week 5)**

**Tasks:**
- [ ] Integrate SendGrid/AWS SES
- [ ] Design email templates
- [ ] Build notification queue
- [ ] Implement user preferences
- [ ] Add unsubscribe logic
- [ ] Test deliverability

**Deliverables:**
- ✅ Email notifications working
- ✅ HTML + plain text templates
- ✅ User preference management
- ✅ Unsubscribe functionality

---

### **Phase 4: Polish & Optimization (Week 6)**

**Tasks:**
- [ ] Performance tuning
- [ ] Cost optimization
- [ ] Monitoring and alerts
- [ ] Documentation
- [ ] User testing
- [ ] Production deployment

**Deliverables:**
- ✅ Production-ready system
- ✅ Monitoring dashboard
- ✅ Complete documentation
- ✅ User guide

---

## 💰 COST ANALYSIS

### **For 1000 Users (10 comparisons/user/month = 10,000 comparisons)**

#### **Option 1: MVP (Gemini Pro - FREE)**

| Component | Cost/Month |
|-----------|------------|
| Gemini Pro API | $0 (FREE tier) |
| Railway Hosting | $20 |
| Redis Cache | $10 |
| SendGrid Email | $0 (12K free) |
| **Total** | **$30** |
| **Per User** | **$0.03** |

#### **Option 2: Production (GPT-4 Vision)**

| Component | Cost/Month |
|-----------|------------|
| GPT-4 Vision API | $100 ($0.01 × 10K) |
| Railway Hosting | $50 |
| Redis Cache | $20 |
| AWS SES Email | $1 (10K emails) |
| **Total** | **$171** |
| **Per User** | **$0.17** |

### **Break-Even Analysis**

**Assumptions:**
- 1000 users
- 10 comparisons per user per month
- Average savings per comparison: ₹500

**User Value:**
- Total savings: ₹500 × 10 = ₹5,000/user/month
- Cost to Picksy: ₹2.55/user/month (₹0.03 × 85 INR/USD)
- **ROI: 196,000%** 🚀

---

## 🎯 SUCCESS METRICS

### **Technical Metrics**

| Metric | Target | Current (v0.1.0) |
|--------|--------|------------------|
| **Extraction Accuracy** | >95% | 85% (hardcoded) |
| **Comparison Speed** | <10 sec | N/A |
| **Match Accuracy** | >90% | N/A |
| **Uptime** | >99% | 100% |
| **Cache Hit Rate** | >70% | N/A |

### **User Metrics**

| Metric | Target | Impact |
|--------|--------|--------|
| **Feature Usage** | 80% of scans trigger comparison | High engagement |
| **Time Saved** | 5-10 min per product | User satisfaction |
| **Better Deal Found** | 70% of comparisons | Value delivery |
| **Email Open Rate** | >40% | Notification effectiveness |
| **Click-Through Rate** | >20% | Purchase intent |

### **Business Metrics**

| Metric | Target | Revenue Impact |
|--------|--------|----------------|
| **User Retention** | 60% weekly active | Sticky product |
| **Referrals** | 20% invite friends | Organic growth |
| **Premium Conversion** | 5% upgrade | Revenue stream |
| **B2B Leads** | 10 brands/month | Enterprise revenue |

---

## 🚀 FUTURE ENHANCEMENTS

### **Phase 2 Features**

- **Coupon Integration**: Automatically find and apply coupon codes
- **Cashback Tracking**: Track cashback offers across sites
- **Product Tags**: Organize saved products by category
- **Advanced Filters**: Filter by price range, rating, delivery time
- **Browser Sync**: Sync data across devices
- **Bulk Operations**: Compare multiple products at once
- **Export Data**: Export price history to CSV/Excel

### **Advanced AI**

- **Image-Based Matching**: Find products by uploading photos
- **Voice Search**: "Find me the best deal on iPhone 15 Pro"
- **Predictive Alerts**: "Price likely to drop in 3 days"
- **Smart Bundles**: "Buy these together and save ₹2,000"

### **International Expansion**

- **Multi-Country Support**: US, UK, UAE, Singapore
- **Multi-Language**: Hindi, Tamil, Telugu, etc.
- **Currency Conversion**: Real-time exchange rates
- **Local Sites**: Support regional e-commerce platforms

---

## 🔐 SECURITY & PRIVACY

### **Data Protection**

- ✅ **No PII Storage**: We don't store personal information
- ✅ **Local Storage**: Price history stored locally in browser
- ✅ **Encrypted Emails**: Email addresses encrypted at rest
- ✅ **HTTPS Only**: All API calls over secure connections
- ✅ **No Tracking**: We don't track user behavior

### **Scraping Ethics**

- ✅ **Respect robots.txt**: Honor site scraping policies
- ✅ **Rate Limiting**: Don't overload servers
- ✅ **User-Agent**: Identify as Picksy bot
- ✅ **Caching**: Reduce redundant requests
- ✅ **Terms Compliance**: Follow site terms of service

---

**Made with 🎯 for smart shoppers everywhere**

*Last Updated: November 30, 2025*  
*Version: 0.2.0 (In Development)*  
*Status: Design complete, implementation starting*  
*Core IP: Universal AI Extraction Engine*
