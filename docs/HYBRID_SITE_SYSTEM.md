# 🔄 Hybrid Site Management System

## Overview

The **Hybrid Site Management System** combines the best of both worlds:
- **Hardcoded Sites** (26 verified sites) - Fast, reliable, curated
- **AI Discovery** (Unlimited sites) - Scalable, automatic, intelligent

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    HYBRID SITE MANAGER                     │
├─────────────────────────────────────────────────────────────┤
│  Priority 1: HARDCODED SITES (26 sites)                   │
│  ✅ Instant access                                          │
│  ✅ 100% reliable                                           │
│  ✅ Curated trust scores                                    │
│  ✅ Verified search patterns                                │
├─────────────────────────────────────────────────────────────┤
│  Priority 2: USER-ADDED SITES                              │
│  ✅ Manual additions                                        │
│  ✅ Custom configurations                                   │
│  ✅ User control                                            │
├─────────────────────────────────────────────────────────────┤
│  Priority 3: AI-DISCOVERED SITES (Unlimited)               │
│  🤖 Automatic discovery                                     │
│  🤖 Gemini-powered analysis                                 │
│  🤖 Self-expanding database                                 │
│  🤖 Confidence scoring                                      │
└─────────────────────────────────────────────────────────────┘
```

## Current Hardcoded Sites (26 Total)

### Tier 1: Official Brand Stores (Trust: 10/10)
- Apple India
- Samsung India

### Tier 2: Major Marketplaces (Trust: 9/10)
- Amazon India
- Flipkart
- Myntra
- Ajio
- Tata CLiQ

### Tier 3: Verified Retailers (Trust: 8/10)
- Croma
- Reliance Digital
- Vijay Sales
- Healthkart
- Nykaa
- FirstCry
- Decathlon
- Snapdeal
- Shoppers Stop
- Pepperfry
- Urban Ladder
- Lenskart
- Boat Lifestyle
- Noise
- Bewakoof
- Chumbak
- Purplle
- BigBasket
- Zivame

## AI Discovery Process

### Step 1: Detection
```javascript
// User visits unknown site
const currentDomain = "newstore.com";
const isKnown = await SiteManager.canCompareOnCurrentSite();

if (!isKnown) {
  // Trigger AI discovery
  await SiteManager.handleUnknownSite(productQuery);
}
```

### Step 2: Analysis
```javascript
// Gemini analyzes the homepage
const prompt = `
Analyze this e-commerce website and find search functionality:
- Search URL pattern
- Search parameter name
- Site legitimacy
- Product categories
- Trust indicators

HTML: ${homepageHtml}
`;
```

### Step 3: Verification
```javascript
// Test the discovered search pattern
const testUrl = `${searchUrl}?${searchParam}=test+product`;
const testResults = await fetchPage(testUrl);

// Verify with Gemini
const hasResults = await verifySearchResults(testResults);
```

### Step 4: Storage
```javascript
// Save to Chrome storage
const discoveredSite = {
  name: "New Store",
  domain: "newstore.com",
  searchUrl: "https://newstore.com/search",
  searchParam: "q",
  trustScore: 7, // AI-discovered sites start at 7
  source: "ai-discovered",
  confidence: 0.9
};

await chrome.storage.sync.set({ aiDiscoveredSites: [...existing, discoveredSite] });
```

## Usage Examples

### Basic Comparison
```javascript
// Get search URLs for all available sites
const searchUrls = await SiteManager.generateSearchUrls("iPhone 15 Pro", {
  maxSites: 12,
  minTrustScore: 6
});

// Result includes hardcoded + AI-discovered sites
console.log(`Searching ${searchUrls.length} sites`);
```

### Smart Comparison (Auto-Discovery)
```javascript
// Automatically handles unknown sites
const results = await SiteManager.smartComparison("Samsung Galaxy S24");

// If current site is unknown, AI will try to discover it
// Then proceed with comparison across all available sites
```

### Site Statistics
```javascript
const stats = await SiteManager.getSiteStatistics();

console.log(`
Total sites: ${stats.total}
- Hardcoded: ${stats.sources.hardcoded}
- User-added: ${stats.sources.userAdded}
- AI-discovered: ${stats.sources.aiDiscovered}
`);
```

## Benefits of Hybrid Approach

### 🚀 **Speed**
- Hardcoded sites: Instant access (0ms)
- AI discovery: Only when needed (10-15s)

### 🎯 **Reliability**
- Hardcoded sites: 100% verified
- AI sites: Confidence scoring + verification

### 📈 **Scalability**
- Hardcoded: 26 sites (manual curation)
- AI: Unlimited sites (automatic expansion)

### 💰 **Cost Efficiency**
- Hardcoded: No API costs
- AI: Only pays for new site discovery

### 🔧 **Maintenance**
- Hardcoded: Occasional updates
- AI: Self-maintaining and expanding

## Testing the System

### Test 1: Hardcoded Sites
```bash
# Open test.html
# Click "Test Site Manager"
# Should show 26 hardcoded sites
```

### Test 2: AI Discovery
```bash
# Open test.html
# Enter domain: "paytmmall.com"
# Click "Discover Site"
# Should analyze and add the site
```

### Test 3: Smart Comparison
```bash
# Visit any product page
# Run: SiteManager.smartComparison("product name")
# Should use all available sites (hardcoded + discovered)
```

## Integration with Main Extension

### In Content Script
```javascript
// extension/src/content/content.js
import SiteManager from '../utils/siteManager.js';

async function compareProduct() {
  // Extract current product
  const productQuery = extractKeywords(document.body.innerHTML);
  
  // Smart comparison (handles unknown sites automatically)
  const searchUrls = await SiteManager.smartComparison(productQuery.searchQuery);
  
  // Proceed with scraping and comparison
  const results = await scrapeAllSites(searchUrls);
  
  return results;
}
```

### In Popup
```javascript
// extension/src/popup/popup.js
async function showSiteStats() {
  const stats = await SiteManager.getSiteStatistics();
  
  document.getElementById('siteCount').textContent = 
    `${stats.total} sites (${stats.sources.hardcoded} verified + ${stats.sources.aiDiscovered} discovered)`;
}
```

## Future Enhancements

### Phase 1 (Current)
- ✅ 26 hardcoded sites
- ✅ AI discovery system
- ✅ Hybrid management

### Phase 2 (Next Week)
- 🔄 User feedback on AI-discovered sites
- 🔄 Trust score updates based on success rate
- 🔄 Site performance monitoring

### Phase 3 (Next Month)
- 🔄 Cloud database for sharing discoveries
- 🔄 Community voting on site reliability
- 🔄 Automatic site health checks

### Phase 4 (Future)
- 🔄 Machine learning for better discovery
- 🔄 Regional site recommendations
- 🔄 Category-specific site prioritization

## Configuration

### Enable/Disable AI Discovery
```javascript
// In extension settings
const settings = {
  enableAIDiscovery: true,        // Allow automatic site discovery
  maxAIDiscoveredSites: 50,       // Limit AI-discovered sites
  aiDiscoveryTimeout: 15000,      // 15 seconds max per discovery
  minTrustScoreForAI: 6          // Minimum trust for AI sites
};
```

### Site Management
```javascript
// View all sites
const allSites = await SiteManager.getAllSites();

// Remove AI-discovered site
await SiteManager.removeAIDiscoveredSite('domain.com');

// Reset AI discoveries
await chrome.storage.sync.remove('aiDiscoveredSites');
```

## Error Handling

### AI Discovery Failures
- Site not accessible → Skip and continue
- Invalid search pattern → Mark as failed
- Gemini API error → Retry with exponential backoff
- No search functionality → Not an e-commerce site

### Fallback Strategy
1. Try hardcoded sites first
2. If AI discovery fails, continue with known sites
3. Never block comparison due to discovery failure
4. Log failures for debugging

## Performance Metrics

### Target Performance
- Hardcoded site lookup: < 1ms
- AI discovery: < 15 seconds
- Total comparison time: < 30 seconds
- Success rate: > 80% for legitimate e-commerce sites

### Monitoring
```javascript
// Track discovery success rate
const metrics = {
  totalAttempts: 0,
  successfulDiscoveries: 0,
  failedDiscoveries: 0,
  averageDiscoveryTime: 0
};
```

---

## Summary

The **Hybrid Site Management System** gives you:

1. **Immediate access** to 26 verified sites
2. **Automatic expansion** to unlimited sites via AI
3. **Zero maintenance** for new site additions
4. **Cost-effective** scaling (only pay for discoveries)
5. **Reliable fallback** if AI fails

This approach ensures your extension works great out of the box with curated sites, while automatically growing its capabilities as users encounter new shopping sites.

**Next Step:** Test the system and integrate with your popup UI! 🚀