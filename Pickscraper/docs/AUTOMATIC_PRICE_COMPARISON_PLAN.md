# 🎯 Picksy Automatic Price Comparison - Technical Plan

## **Executive Summary**
Implement automatic real-time price comparison across trusted e-commerce sites, showing users the best deals instantly without manual searching.

---

## **1. Current vs. Proposed Flow**

### **Current Flow (Manual)**
```
User scans product → Extension shows price → 
User clicks "Compare" tab → User manually clicks links → 
User opens 3-5 sites → User compares prices manually
```
**Problem**: Takes 5-10 minutes, tedious, error-prone

### **Proposed Flow (Automatic)**
```
User scans product → Extension automatically scrapes 3-5 sites → 
Shows comparison table in 10-15 seconds → 
User sees best deal instantly
```
**Benefit**: Saves 5-10 minutes per product, accurate, effortless

---

## **2. Technical Architecture**

### **Component Overview**
```
┌─────────────────────────────────────────────────────┐
│                   USER INTERFACE                     │
│  (Popup showing comparison table with prices)       │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│              BACKGROUND WORKER                       │
│  • Receives product info from content script        │
│  • Normalizes product title & extracts keywords     │
│  • Triggers parallel scraping on multiple sites     │
│  • Aggregates results & calculates best deal        │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│           TAB-BASED SCRAPER ENGINE                   │
│  • Opens invisible Chrome tabs (one per site)       │
│  • Injects content scripts to extract prices        │
│  • Validates data & closes tabs                     │
│  • Returns results to background worker             │
└─────────────────────────────────────────────────────┘
```

---

## **3. Detailed Workflow**

### **Step 1: Product Scan (Existing)**
- User visits Amazon/Flipkart/Myntra product page
- Clicks "Scan This Page"
- Extension extracts: Title, Price, Brand, Specs

**Example Output:**
```javascript
{
  title: "Optimum Nutrition Performance Whey Protein 1kg",
  brand: "Optimum Nutrition",
  keywords: ["Optimum Nutrition", "Whey Protein", "1kg"],
  currentPrice: 2620,
  currentSite: "optimumnutrition.in"
}
```

### **Step 2: Automatic Comparison Trigger**
- Background worker receives product data
- Checks cache (if price was fetched in last 6 hours, use cached)
- If not cached, triggers parallel scraping

### **Step 3: Parallel Scraping**
**Sites to Scrape (Whitelist):**
1. Amazon India (if not current site)
2. Flipkart (if not current site)
3. Official Brand Website (if detected)
4. Myntra (for fashion items)
5. Healthkart (for supplements)

**Scraping Process:**
```javascript
// For each site in whitelist:
1. Generate search URL with keywords
   Example: "https://amazon.in/s?k=Optimum+Nutrition+Whey+Protein+1kg"

2. Open invisible Chrome tab
   chrome.tabs.create({ url: searchUrl, active: false })

3. Wait 5-8 seconds for page load

4. Inject content script to:
   - Find first 3 search results
   - Extract: Title, Price, Rating, Reviews
   - Match against original product (confidence score)
   - Return best match

5. Close tab
   chrome.tabs.remove(tabId)

6. Store result with metadata:
   {
     site: "Amazon India",
     price: 2450,
     rating: 4.5,
     reviews: 2300,
     confidence: 95%, // How sure we are it's the same product
     url: "https://amazon.in/dp/B00XYZ123",
     trustScore: 9/10
   }
```

**Timing:**
- Each site: 8-10 seconds
- 5 sites in parallel: ~10-12 seconds total
- Sequential fallback: ~40-50 seconds

### **Step 4: Product Matching Algorithm**
**Goal**: Ensure we're comparing the SAME product

**Matching Criteria:**
```javascript
function calculateConfidence(scrapedProduct, originalProduct) {
  let score = 0;
  
  // Brand match (40 points)
  if (scrapedProduct.brand === originalProduct.brand) score += 40;
  
  // Product type match (30 points)
  if (scrapedProduct.title.includes(originalProduct.productType)) score += 30;
  
  // Specs match (20 points)
  // Example: Both have "1kg" or "128GB"
  if (specsMatch(scrapedProduct, originalProduct)) score += 20;
  
  // Price range check (10 points)
  // Price should be within 50% range (prevents matching wrong products)
  if (priceInRange(scrapedProduct.price, originalProduct.price)) score += 10;
  
  return score; // 0-100
}
```

**Confidence Levels:**
- 90-100%: ✅ Show as "Exact Match"
- 75-89%: ⚠️ Show as "Likely Match"
- <75%: ❌ Don't show (too risky)

### **Step 5: Results Aggregation**
**Background worker collects all results:**
```javascript
{
  originalSite: {
    name: "Optimum Nutrition Official",
    price: 2620,
    trustScore: 10/10,
    rating: null,
    badge: "Official Store"
  },
  comparisons: [
    {
      site: "Amazon India",
      price: 2450,
      trustScore: 9/10,
      rating: 4.5,
      reviews: 2300,
      confidence: 95%,
      savings: 170 // vs original
    },
    {
      site: "Flipkart",
      price: 2580,
      trustScore: 9/10,
      rating: 4.3,
      reviews: 1800,
      confidence: 92%,
      savings: 40
    },
    // ... more results
  ]
}
```

### **Step 6: Smart Recommendations**
**Algorithm calculates:**
1. **Best Overall Deal**: Highest (trustScore × confidence) + lowest price
2. **Lowest Price**: Cheapest from sites with confidence >85%
3. **Most Trusted**: Highest trustScore (official stores prioritized)
4. **Best Value**: Balance of price, trust, and reviews

### **Step 7: Display Results**
**UI Updates:**
```
┌─────────────────────────────────────────────────────┐
│ 🎯 Price Comparison for Optimum Nutrition Whey     │
├─────────────────────────────────────────────────────┤
│ 💰 BEST DEAL - Save ₹170!                          │
│ 🛒 Amazon India                    ₹2,450          │
│ ⭐ 4.5 (2.3K reviews) | 95% match | Trust: 9/10   │
│ [View on Amazon →]                                  │
├─────────────────────────────────────────────────────┤
│ 🏢 OFFICIAL STORE                  ₹2,620          │
│ Optimum Nutrition Official                          │
│ ✅ 100% Authentic | Trust: 10/10                   │
│ [View on Official Site →]                          │
├─────────────────────────────────────────────────────┤
│ Flipkart                           ₹2,580          │
│ ⭐ 4.3 (1.8K) | 92% match | Save ₹40              │
│ [View on Flipkart →]                               │
└─────────────────────────────────────────────────────┘
```

---

## **4. Safety & Trust Measures**

### **Whitelist System**
```javascript
const TRUSTED_SITES = {
  tier1: [ // Official stores - Trust: 10/10
    'optimumnutrition.in',
    'apple.com',
    'samsung.com'
  ],
  tier2: [ // Major marketplaces - Trust: 9/10
    'amazon.in',
    'flipkart.com',
    'myntra.com'
  ],
  tier3: [ // Verified retailers - Trust: 8/10
    'croma.com',
    'vijaysales.com',
    'reliancedigital.in'
  ]
};
```

**Only scrape from whitelisted sites** - No shady websites, ever.

### **Data Validation**
```javascript
function validateScrapedData(data) {
  // Price sanity check
  if (data.price < 100 || data.price > 10000000) return false;
  
  // Title must exist
  if (!data.title || data.title.length < 10) return false;
  
  // URL must be from whitelisted domain
  if (!isWhitelisted(data.url)) return false;
  
  return true;
}
```

### **Rate Limiting**
- Max 5 sites scraped per product
- 3-second delay between tab opens
- Max 10 scraping operations per minute
- Prevents getting blocked by sites

---

## **5. Caching Strategy**

### **Why Cache?**
- Avoid re-scraping same product multiple times
- Faster results for users
- Reduces load on e-commerce sites

### **Cache Rules**
```javascript
const CACHE_DURATION = {
  electronics: 6 * 60 * 60 * 1000,  // 6 hours
  fashion: 2 * 60 * 60 * 1000,      // 2 hours
  supplements: 12 * 60 * 60 * 1000, // 12 hours
  default: 6 * 60 * 60 * 1000       // 6 hours
};
```

### **Cache Storage**
```javascript
// Stored in chrome.storage.local
{
  "cache_amazon_B00XYZ123": {
    productId: "B00XYZ123",
    prices: [...],
    timestamp: 1234567890,
    expiresAt: 1234589490
  }
}
```

---

## **6. Performance Optimization**

### **Parallel Scraping**
- Open all tabs simultaneously (not sequential)
- 5 sites in 10 seconds vs. 50 seconds

### **Progressive Loading**
```
User clicks scan → Show current site price immediately →
Show "Fetching prices from 4 other sites..." →
Update UI as each result comes in →
Show final comparison table
```

### **Fallback Strategy**
```javascript
// If scraping fails:
1. Try cached data (even if expired)
2. Show manual search links
3. Log error for debugging
4. Don't block user experience
```

---

## **7. Error Handling**

### **Common Failures & Solutions**

| Error | Cause | Solution |
|-------|-------|----------|
| Tab creation fails | Too many tabs open | Queue requests, retry |
| Page load timeout | Slow internet | Increase timeout to 15s |
| Content script fails | Site structure changed | Fallback to manual link |
| No matches found | Product not available | Show "Not found on X site" |
| CAPTCHA detected | Anti-bot measures | Skip site, show warning |

---

## **8. Implementation Timeline**

### **Phase 1: Core Scraping (2 days)**
- [ ] Build parallel tab scraper
- [ ] Implement product matching algorithm
- [ ] Add whitelist system
- [ ] Test on 3 sites (Amazon, Flipkart, Official)

### **Phase 2: UI & UX (1 day)**
- [ ] Design comparison table
- [ ] Add loading states
- [ ] Implement progressive updates
- [ ] Add error messages

### **Phase 3: Optimization (1 day)**
- [ ] Add caching system
- [ ] Implement rate limiting
- [ ] Add confidence scoring
- [ ] Performance testing

### **Phase 4: Testing & Polish (1 day)**
- [ ] Test on 20+ products
- [ ] Fix edge cases
- [ ] Optimize timing
- [ ] User testing

**Total: 5 days**

---

## **9. Success Metrics**

### **Technical KPIs**
- Scraping success rate: >90%
- Average comparison time: <15 seconds
- Product match accuracy: >85%
- Cache hit rate: >60%

### **User Experience KPIs**
- Time saved per product: 5-10 minutes
- User satisfaction: "Found better deal" >70%
- Feature usage: >80% of scans trigger comparison

---

## **10. Future Enhancements**

### **V2 Features (Post-MVP)**
1. **Cloud Backend**: Faster scraping (5 seconds vs 15 seconds)
2. **More Sites**: 20+ e-commerce sites
3. **Price History Comparison**: Show price trends across sites
4. **Deal Alerts**: "Product X is ₹500 cheaper on Amazon today!"
5. **Image Matching**: Use product images to verify matches

---

## **11. Risks & Mitigation**

| Risk | Impact | Mitigation |
|------|--------|------------|
| Sites block scraping | HIGH | Rotate user agents, add delays, respect robots.txt |
| Site structure changes | MEDIUM | Modular scrapers, easy to update |
| Legal issues | HIGH | Only scrape public data, add disclaimers |
| Performance issues | MEDIUM | Caching, parallel processing, timeouts |
| Inaccurate matches | HIGH | Strict confidence thresholds, manual verification option |

---

## **12. Questions for Team Discussion**

1. **Backend or No Backend?**
   - MVP: Browser-based (free, slower)
   - Future: Cloud backend (faster, costs $10-20/month)

2. **How many sites to support initially?**
   - Recommendation: Start with 5, expand to 10-15

3. **Monetization strategy?**
   - Affiliate links (earn commission on purchases)
   - Premium features (more sites, faster updates)
   - Keep free with optional donations

4. **Privacy concerns?**
   - All scraping happens locally in user's browser
   - No data sent to external servers (MVP)
   - User controls when comparison happens

---

## **13. Technical Requirements**

### **Browser APIs Used**
- `chrome.tabs` - Create/manage invisible tabs
- `chrome.scripting` - Inject content scripts
- `chrome.storage` - Cache comparison results
- `chrome.runtime` - Message passing between components

### **Dependencies**
- No external libraries needed for MVP
- All scraping done with vanilla JavaScript
- Uses existing Picksy infrastructure

### **Browser Compatibility**
- Chrome/Edge: Full support
- Firefox: Requires WebExtensions API adaptation
- Safari: Limited support (no background tabs)

---

## **14. Security Considerations**

### **User Data Protection**
- No personal data collected
- No browsing history stored
- Prices cached locally only
- No external API calls (MVP)

### **Safe Scraping Practices**
- Only public product pages
- Respect robots.txt
- Rate limiting to avoid abuse
- User-agent identification
- No login/authentication scraping

### **Content Security**
- Validate all scraped data
- Sanitize HTML before display
- Prevent XSS attacks
- Secure message passing

---

## **15. User Experience Flow**

### **Happy Path**
```
1. User on Amazon iPhone page
2. Clicks "Scan This Page"
3. Sees: "Scanning... Found iPhone 15 128GB"
4. Sees: "Comparing prices on 4 other sites..."
5. Progress: "✓ Flipkart | ⏳ Official Store | ⏳ Croma..."
6. After 12 seconds: Full comparison table
7. Sees: "💰 Best Deal: Flipkart - Save ₹2,000!"
8. Clicks "View on Flipkart" → Opens in new tab
```

### **Error Path**
```
1. User on Amazon iPhone page
2. Clicks "Scan This Page"
3. Sees: "Scanning... Found iPhone 15 128GB"
4. Sees: "Comparing prices..."
5. One site fails: "⚠️ Croma unavailable"
6. Shows results from 3 successful sites
7. Option to "Try manual search on Croma"
```

---

## **16. Competitive Analysis**

### **Existing Solutions**
1. **Honey**: Browser extension, focuses on coupons
2. **CamelCamelCamel**: Amazon-only price tracking
3. **PriceBaba**: Manual comparison website
4. **Google Shopping**: Search-based comparison

### **Picksy Advantages**
- ✅ Automatic (no manual searching)
- ✅ Works on product pages directly
- ✅ Trust scores & recommendations
- ✅ Official website detection
- ✅ Indian e-commerce focus
- ✅ Privacy-focused (local processing)

---

## **17. Launch Checklist**

### **Pre-Launch**
- [ ] Complete all 4 implementation phases
- [ ] Test on 50+ products across categories
- [ ] Verify legal compliance
- [ ] Add user documentation
- [ ] Create demo video
- [ ] Set up error logging

### **Launch**
- [ ] Soft launch to beta users (50-100)
- [ ] Collect feedback
- [ ] Monitor error rates
- [ ] Track success metrics
- [ ] Iterate based on feedback

### **Post-Launch**
- [ ] Public release
- [ ] Marketing push
- [ ] Monitor performance
- [ ] Plan V2 features
- [ ] Scale infrastructure if needed

---

**Document Version**: 1.0  
**Last Updated**: November 23, 2025  
**Author**: Picksy Development Team  
**Status**: Ready for Team Review
