# 🔍 Picksy Comparison Module Documentation

> **Component: Price Comparison Logic for Misc AI Agent**

**Last Updated:** November 30, 2025  
**Version:** v0.2.0 (MVP)  
**Status:** Design Complete - Ready for Implementation  
**File:** `extension/utils/comparison.js`

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Module Functions](#module-functions)
3. [Algorithm Deep Dive](#algorithm-deep-dive)
4. [Usage Examples](#usage-examples)
5. [Testing Guide](#testing-guide)

---

## 🎯 Overview

The Comparison Module is the **brain** of Picksy's price comparison feature. It handles:

1. **Keyword Extraction** - Extracting meaningful search terms from product titles
2. **Site Management** - Maintaining a whitelist of 15 verified e-commerce sites
3. **URL Generation** - Creating search URLs for all relevant sites
4. **Product Matching** - Determining if two products are the same (90%+ accuracy)

---

## 📚 Module Functions

### **1. extractKeywords(title)**

**Purpose:** Extract meaningful keywords from product title for searching.

**Parameters:**
- `title` (string) - Product title

**Returns:**
- `Array<string>` - Array of keywords (max 6)

**Algorithm:**
```
Input: "Apple iPhone 15 Pro 128GB Natural Titanium with Fast Charger"
  ↓
Step 1: Clean & lowercase
  → "apple iphone 15 pro 128gb natural titanium with fast charger"
  ↓
Step 2: Remove special characters
  → "apple iphone 15 pro 128gb natural titanium with fast charger"
  ↓
Step 3: Split into words
  → ["apple", "iphone", "15", "pro", "128gb", "natural", "titanium", "with", "fast", "charger"]
  ↓
Step 4: Remove stop words (the, a, with, and, for, etc.)
  → ["apple", "iphone", "15", "pro", "128gb", "natural", "titanium", "fast", "charger"]
  ↓
Step 5: Take first 6 words
  → ["apple", "iphone", "15", "pro", "128gb", "natural"]
```

**Example:**
```javascript
extractKeywords("Nike Air Max 270 Black Size 10")
// Returns: ["nike", "air", "max", "270", "black", "size"]

extractKeywords("Samsung Galaxy S24 Ultra 256GB Titanium Gray")
// Returns: ["samsung", "galaxy", "s24", "ultra", "256gb", "titanium"]
```

**Why 6 words?**
- Captures: Brand + Model + Variant + Color
- Avoids overly long search queries
- Balances specificity vs. flexibility

---

### **2. generateSearchUrls(title, currentSite, maxSites)**

**Purpose:** Generate search URLs for all relevant sites.

**Parameters:**
- `title` (string) - Product title
- `currentSite` (string) - Current site domain (to exclude)
- `maxSites` (number) - Maximum number of sites (default: 10)

**Returns:**
- `Array<Object>` - Array of search URL objects

**Algorithm:**
```
Input: 
  title: "Nike Air Max 270 Black"
  currentSite: "nike.com"
  maxSites: 10

Step 1: Extract keywords
  → ["nike", "air", "max", "270", "black"]

Step 2: Join keywords
  → "nike air max 270 black"

Step 3: URL encode
  → "nike+air+max+270+black"

Step 4: Get all verified sites
  → 15 sites (tier1 + tier2 + tier3)

Step 5: Filter out current site
  → 14 sites (exclude nike.com)

Step 6: Take first 10 sites
  → 10 sites

Step 7: Generate URLs
  → Replace {query} in each site's searchUrl template
```

**Example:**
```javascript
generateSearchUrls("iPhone 15 Pro 128GB", "apple.com", 10)

// Returns:
[
  {
    name: 'Amazon India',
    domain: 'amazon.in',
    url: 'https://www.amazon.in/s?k=iphone+15+pro+128gb',
    icon: '📦',
    trust: 9,
    keywords: ["iphone", "15", "pro", "128gb"],
    query: "iphone 15 pro 128gb"
  },
  {
    name: 'Flipkart',
    domain: 'flipkart.com',
    url: 'https://www.flipkart.com/search?q=iphone+15+pro+128gb',
    icon: '🛒',
    trust: 9,
    keywords: ["iphone", "15", "pro", "128gb"],
    query: "iphone 15 pro 128gb"
  },
  // ... 8 more sites
]
```

---

### **3. calculateMatchScore(original, candidate)**

**Purpose:** Calculate similarity score between two products.

**Parameters:**
- `original` (Object) - Original product `{ title, priceValue }`
- `candidate` (Object) - Candidate product `{ title, priceValue }`

**Returns:**
- `number` - Match score (0-100)

**Algorithm:**
```
Final Score = (Token Overlap × 40%) + 
              (Text Similarity × 30%) + 
              (Price Similarity × 20%) + 
              (Brand Match × 10%)
```

**Component Breakdown:**

#### **A. Token Overlap (40% weight)**
```javascript
Original:  "iPhone 15 Pro 128GB"
Candidate: "Apple iPhone 15 Pro 128GB"

Original tokens:  ["iphone", "15", "pro", "128gb"]
Candidate tokens: ["apple", "iphone", "15", "pro", "128gb"]
Common tokens:    ["iphone", "15", "pro", "128gb"]

Score = 4 / 4 = 1.0 (100%)
```

#### **B. Text Similarity (30% weight) - Levenshtein Distance**
```javascript
Original:  "iPhone 15 Pro 128GB" (20 chars)
Candidate: "Apple iPhone 15 Pro 128GB" (26 chars)

Edit distance: 6 characters (added "Apple ")
Max length: 26
Similarity = 1 - (6/26) = 0.77 (77%)
```

#### **C. Price Similarity (20% weight)**
```javascript
Original price:  ₹48,990
Candidate price: ₹48,990

Difference: ₹0
Average: ₹48,990
Score = 1 - (0/48990) = 1.0 (100%)
```

#### **D. Brand Match (10% weight)**
```javascript
Original brand:  "iPhone" → "Apple"
Candidate brand: "Apple"

Match: Yes
Score = 1.0 (100%)
```

**Final Calculation:**
```javascript
(1.0 × 0.40) + (0.77 × 0.30) + (1.0 × 0.20) + (1.0 × 0.10)
= 0.40 + 0.23 + 0.20 + 0.10
= 0.93 = 93% ✅ EXACT MATCH
```

---

### **4. matchProducts(original, candidates)**

**Purpose:** Match products and categorize by confidence level.

**Parameters:**
- `original` (Object) - Original product
- `candidates` (Array<Object>) - Array of candidate products

**Returns:**
- `Object` - Categorized matches

**Algorithm:**
```
For each candidate:
  1. Calculate match score (0-100)
  2. Categorize:
     - Score ≥ 90: EXACT MATCH
     - Score 70-89: SIMILAR PRODUCT
     - Score < 70: DISCARD
  3. Sort by price (lowest first)
```

**Example:**
```javascript
const original = {
  title: "iPhone 15 Pro 128GB",
  priceValue: 48990
};

const candidates = [
  { title: "Apple iPhone 15 Pro 128GB", priceValue: 48990 },
  { title: "iPhone 15 Pro 256GB", priceValue: 57990 },
  { title: "Samsung Galaxy S24", priceValue: 64990 }
];

matchProducts(original, candidates)

// Returns:
{
  exact: [
    { 
      title: "Apple iPhone 15 Pro 128GB", 
      priceValue: 48990, 
      confidence: 93 
    }
  ],
  similar: [
    { 
      title: "iPhone 15 Pro 256GB", 
      priceValue: 57990, 
      confidence: 75 
    }
  ],
  discarded: [
    { 
      title: "Samsung Galaxy S24", 
      priceValue: 64990, 
      confidence: 17 
    }
  ]
}
```

---

## 🔬 Algorithm Deep Dive

### **Levenshtein Distance Algorithm**

**Purpose:** Measure the minimum number of edits needed to transform one string into another.

**Example:**
```
String A: "kitten"
String B: "sitting"

Edits needed:
1. kitten → sitten  (substitute 'k' → 's')
2. sitten → sittin  (substitute 'e' → 'i')
3. sittin → sitting (insert 'g')

Distance: 3
```

**Matrix Calculation:**
```
       ""  s  i  t  t  i  n  g
    "" 0   1  2  3  4  5  6  7
    k  1   1  2  3  4  5  6  7
    i  2   2  1  2  3  4  5  6
    t  3   3  2  1  2  3  4  5
    t  4   4  3  2  1  2  3  4
    e  5   5  4  3  2  2  3  4
    n  6   6  5  4  3  3  2  3
```

**Code:**
```javascript
function levenshteinDistance(a, b) {
  const matrix = [];
  
  // Initialize first column (0, 1, 2, 3, ...)
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  // Initialize first row (0, 1, 2, 3, ...)
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        // Characters match, no edit needed
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        // Take minimum of: substitute, insert, delete
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitute
          matrix[i][j - 1] + 1,     // insert
          matrix[i - 1][j] + 1      // delete
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}
```

---

### **Verified Sites Structure**

**3-Tier Trust System:**

| Tier | Trust Score | Sites | Criteria |
|------|-------------|-------|----------|
| **Tier 1** | 10/10 | Apple, Samsung, Nike, Adidas, Puma | Official brand stores |
| **Tier 2** | 9/10 | Amazon, Flipkart, Myntra, Ajio, Tata CLiQ | Major marketplaces |
| **Tier 3** | 8/10 | Croma, Reliance Digital, Vijay Sales, Healthkart, Nykaa | Verified retailers |

**Site Object Structure:**
```javascript
{
  name: 'Amazon India',           // Display name
  domain: 'amazon.in',            // Domain for filtering
  searchUrl: 'https://...',       // URL template with {query}
  icon: '📦',                     // Emoji icon
  trust: 9,                       // Trust score (8-10)
  category: ['all']               // Product categories
}
```

---

## 💡 Usage Examples

### **Example 1: Basic Keyword Extraction**

```javascript
// Import the module
const { extractKeywords } = require('./comparison.js');

// Extract keywords
const keywords = extractKeywords("Apple iPhone 15 Pro 128GB Natural Titanium");
console.log(keywords);
// Output: ["apple", "iphone", "15", "pro", "128gb", "natural"]
```

### **Example 2: Generate Search URLs**

```javascript
const { generateSearchUrls } = require('./comparison.js');

// Generate URLs (exclude current site)
const urls = generateSearchUrls(
  "Nike Air Max 270 Black",
  "nike.com",
  5  // Only 5 sites
);

console.log(urls);
// Output: [
//   { name: "Amazon India", url: "...", trust: 9 },
//   { name: "Flipkart", url: "...", trust: 9 },
//   { name: "Myntra", url: "...", trust: 9 },
//   { name: "Ajio", url: "...", trust: 9 },
//   { name: "Tata CLiQ", url: "...", trust: 9 }
// ]
```

### **Example 3: Calculate Match Score**

```javascript
const { calculateMatchScore } = require('./comparison.js');

const original = {
  title: "iPhone 15 Pro 128GB",
  priceValue: 48990
};

const candidate = {
  title: "Apple iPhone 15 Pro 128GB Natural Titanium",
  priceValue: 48990
};

const score = calculateMatchScore(original, candidate);
console.log(score);
// Output: 93 (93% match - EXACT)
```

### **Example 4: Match Multiple Products**

```javascript
const { matchProducts } = require('./comparison.js');

const original = {
  title: "iPhone 15 Pro 128GB",
  priceValue: 48990
};

const candidates = [
  { title: "Apple iPhone 15 Pro 128GB", priceValue: 48990 },
  { title: "iPhone 15 Pro 256GB", priceValue: 57990 },
  { title: "iPhone 14 Pro 128GB", priceValue: 42990 },
  { title: "Samsung Galaxy S24", priceValue: 64990 }
];

const matches = matchProducts(original, candidates);
console.log(matches);
// Output: {
//   exact: [{ title: "Apple iPhone 15 Pro 128GB", confidence: 93 }],
//   similar: [
//     { title: "iPhone 15 Pro 256GB", confidence: 75 },
//     { title: "iPhone 14 Pro 128GB", confidence: 72 }
//   ],
//   discarded: [{ title: "Samsung Galaxy S24", confidence: 17 }]
// }
```

---

## 🧪 Testing Guide

### **Test Case 1: Exact Match**

```javascript
const original = {
  title: "Nike Air Max 270 Black Size 10",
  priceValue: 12995
};

const candidate = {
  title: "Nike Air Max 270 Black Men's Shoes Size 10",
  priceValue: 12995
};

const score = calculateMatchScore(original, candidate);
// Expected: 90-100 (EXACT MATCH)
```

### **Test Case 2: Similar Product (Different Variant)**

```javascript
const original = {
  title: "iPhone 15 Pro 128GB Natural Titanium",
  priceValue: 48990
};

const candidate = {
  title: "iPhone 15 Pro 256GB Blue Titanium",
  priceValue: 57990
};

const score = calculateMatchScore(original, candidate);
// Expected: 70-89 (SIMILAR)
```

### **Test Case 3: Different Product**

```javascript
const original = {
  title: "iPhone 15 Pro 128GB",
  priceValue: 48990
};

const candidate = {
  title: "Samsung Galaxy S24 Ultra 256GB",
  priceValue: 64990
};

const score = calculateMatchScore(original, candidate);
// Expected: 0-69 (DISCARD)
```

### **Test Case 4: Keyword Extraction Edge Cases**

```javascript
// Long title with many filler words
extractKeywords("The Best Apple iPhone 15 Pro with 128GB Storage in Natural Titanium Color and Fast Charger");
// Expected: ["best", "apple", "iphone", "15", "pro", "128gb"]

// Short title
extractKeywords("iPhone 15");
// Expected: ["iphone", "15"]

// Title with special characters
extractKeywords("Nike Air Max 270 (Black) - Size 10 [Men's]");
// Expected: ["nike", "air", "max", "270", "black", "size"]
```

---

## 📊 Performance Metrics

### **Accuracy Targets**

| Metric | Target | Current |
|--------|--------|---------|
| **Exact Match Accuracy** | >95% | TBD |
| **Similar Match Accuracy** | >85% | TBD |
| **False Positive Rate** | <5% | TBD |
| **Processing Time** | <100ms per product | TBD |

### **Scoring Distribution**

```
Score Range | Category | Expected %
------------|----------|------------
90-100      | Exact    | 60-70%
70-89       | Similar  | 20-30%
0-69        | Discard  | 10-20%
```

---

## 🔧 Configuration

### **Adjustable Parameters**

```javascript
// In extractKeywords()
const MAX_KEYWORDS = 6;  // Maximum keywords to extract

// In generateSearchUrls()
const DEFAULT_MAX_SITES = 10;  // Default number of sites

// In calculateMatchScore()
const WEIGHTS = {
  tokenOverlap: 0.40,    // 40% weight
  textSimilarity: 0.30,  // 30% weight
  priceSimilarity: 0.20, // 20% weight
  brandMatch: 0.10       // 10% weight
};

// In matchProducts()
const THRESHOLDS = {
  exact: 90,    // 90-100% = exact match
  similar: 70   // 70-89% = similar product
};
```

---

## 🚀 Future Enhancements

### **Phase 2 Improvements**

1. **Machine Learning**
   - Train model on user feedback
   - Improve matching accuracy over time
   - Personalized scoring weights

2. **Advanced Matching**
   - Image similarity (compare product images)
   - Specification matching (RAM, storage, etc.)
   - Review sentiment comparison

3. **Smart Filtering**
   - Category-based site selection
   - Price range filtering
   - Brand preference learning

4. **Performance**
   - Caching of match scores
   - Parallel processing
   - Optimized algorithms

---

## 📚 References

- **Levenshtein Distance:** [Wikipedia](https://en.wikipedia.org/wiki/Levenshtein_distance)
- **String Similarity:** [Dice Coefficient](https://en.wikipedia.org/wiki/S%C3%B8rensen%E2%80%93Dice_coefficient)
- **Product Matching:** [Fuzzy Matching Techniques](https://en.wikipedia.org/wiki/Approximate_string_matching)

---

**Made with 🔍 for accurate price comparisons**

*Last Updated: November 30, 2025*  
*Version: 0.2.0 (MVP)*  
*Status: Design complete, ready for implementation*
