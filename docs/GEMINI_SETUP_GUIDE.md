# 🤖 Gemini Pro API Setup Guide

**Date:** December 9, 2025  
**Purpose:** Configure Gemini Pro for AI-powered product extraction  
**Cost:** FREE (No API costs)

---

## 🎯 Why Gemini Pro?

- ✅ **FREE**: No API costs (generous free tier)
- ✅ **95% Accuracy**: Excellent for product data extraction
- ✅ **Fast**: Quick response times
- ✅ **Easy Integration**: Simple REST API
- ✅ **No Credit Card**: Can start immediately

---

## 📋 Step-by-Step Setup

### **Step 1: Get Your API Key**

1. Go to: https://makersuite.google.com/app/apikey
2. Click "Create API Key"
3. Select "Create API key in new project" (or use existing)
4. Copy your API key (starts with `AIza...`)

**⚠️ Important:** Keep this key secret! Don't commit to Git.

---

### **Step 2: Test the API**

Open your browser console and test:

```javascript
// Test Gemini Pro API
const API_KEY = 'YOUR_API_KEY_HERE';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

async function testGemini() {
  const response = await fetch(`${API_URL}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: 'Extract product data from this: "iPhone 15 Pro 128GB - ₹48,990"'
        }]
      }]
    })
  });
  
  const data = await response.json();
  console.log(data);
}

testGemini();
```

**Expected Response:**
```json
{
  "candidates": [{
    "content": {
      "parts": [{
        "text": "Product: iPhone 15 Pro\nStorage: 128GB\nPrice: ₹48,990"
      }]
    }
  }]
}
```

---

### **Step 3: Store API Key Securely**

We'll store the API key in Chrome's sync storage (encrypted by Chrome).

**File to create:** `extension/config/config.js`

```javascript
// Configuration management
const Config = {
  // API Keys (will be stored in Chrome storage)
  GEMINI_API_KEY: null,
  
  // API Endpoints
  GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
  
  // Settings
  MAX_RETRIES: 3,
  TIMEOUT: 30000, // 30 seconds
  
  // Initialize config from storage
  async init() {
    const result = await chrome.storage.sync.get(['geminiApiKey']);
    this.GEMINI_API_KEY = result.geminiApiKey || null;
    return this.GEMINI_API_KEY !== null;
  },
  
  // Save API key
  async setApiKey(apiKey) {
    await chrome.storage.sync.set({ geminiApiKey: apiKey });
    this.GEMINI_API_KEY = apiKey;
  },
  
  // Check if configured
  isConfigured() {
    return this.GEMINI_API_KEY !== null;
  }
};
```

---

### **Step 4: Create API Key Setup UI**

Users need to enter their API key once. We'll add a settings section.

**File to update:** `extension/src/popup/popup.html`

Add this section (we'll add it after creating the file):

```html
<!-- API Key Setup Section -->
<div id="apiKeySection" class="section" style="display: none;">
  <h3>🤖 AI Setup Required</h3>
  <p>To use price comparison, you need a free Gemini Pro API key.</p>
  
  <div class="setup-steps">
    <ol>
      <li>Visit <a href="https://makersuite.google.com/app/apikey" target="_blank">Google AI Studio</a></li>
      <li>Click "Create API Key"</li>
      <li>Copy your API key</li>
      <li>Paste it below</li>
    </ol>
  </div>
  
  <input type="text" 
         id="apiKeyInput" 
         placeholder="Paste your API key here (AIza...)"
         class="api-key-input">
  
  <button id="saveApiKeyBtn" class="primary-btn">Save API Key</button>
  
  <p class="note">
    ✅ Your API key is stored securely in Chrome and never shared.
  </p>
</div>
```

---

## 🔧 API Usage Limits

### **Free Tier (Gemini Pro):**
- **60 requests per minute**
- **1,500 requests per day**
- **1 million tokens per month**

### **For Our Use Case:**
- Each comparison = 10 requests (10 sites)
- **6 comparisons per minute** (60 / 10)
- **150 comparisons per day** (1,500 / 10)

**This is MORE than enough for MVP testing!**

---

## 📝 Extraction Prompt Template

Here's the prompt we'll use to extract product data:

```javascript
const EXTRACTION_PROMPT = `You are a product data extraction expert. Analyze the provided HTML and extract product information.

Extract the following fields:
1. title - Full product name
2. price - Current price (number only, no currency)
3. currency - Currency code (INR, USD, EUR, etc.)
4. originalPrice - Original price before discount (if available)
5. discount - Discount percentage (if available)
6. stock - Stock status: "in_stock", "out_of_stock", or "limited_stock"
7. rating - Product rating (0-5 stars)
8. reviews - Number of reviews
9. seller - Seller/brand name
10. image - Product image URL

IMPORTANT RULES:
- Return ONLY valid JSON
- Use null for missing fields
- Extract numbers without currency symbols
- Be precise and accurate

HTML Content:
{HTML_CONTENT}

Return format:
{
  "title": "string",
  "price": number,
  "currency": "string",
  "originalPrice": number | null,
  "discount": number | null,
  "stock": "in_stock" | "out_of_stock" | "limited_stock",
  "rating": number | null,
  "reviews": number | null,
  "seller": "string" | null,
  "image": "string" | null
}`;
```

---

## ✅ Validation Checklist

Before proceeding to Step 3, verify:

- [ ] You have a Gemini Pro API key
- [ ] API key starts with `AIza...`
- [ ] You tested the API and got a response
- [ ] You understand the free tier limits (150 comparisons/day)
- [ ] You're ready to integrate it into the extension

---

## 🚀 Next Steps

Once you have your API key:
1. I'll create `extension/config/config.js`
2. I'll create the API wrapper `extension/utils/aiExtraction.js`
3. We'll test extraction with a sample product page
4. Then move to Step 3 (Keyword Extraction)

---

**Ready to proceed?** 

Just confirm you have your Gemini Pro API key and I'll start building the integration! 🤖

---

**Made with 🤖 for AI-powered extraction**

*Created: December 9, 2025*  
*Status: Setup guide ready*
