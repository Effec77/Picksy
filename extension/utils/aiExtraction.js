/**
 * AI-Powered Product Data Extraction using Gemini Pro
 * Universal extraction that works on ANY e-commerce site
 */

/**
 * Extract product data from HTML using Gemini Pro
 * @param {string} html - Page HTML content
 * @param {string} url - Page URL for context
 * @returns {Promise<Object>} Extracted product data
 */
async function extractProductData(html, url) {
  try {
    // Check if API key is configured
    if (!Config.isConfigured()) {
      throw new Error('Gemini API key not configured');
    }

    // Clean and truncate HTML (Gemini has token limits)
    const cleanedHtml = cleanHtml(html);

    // Build extraction prompt
    const prompt = buildExtractionPrompt(cleanedHtml, url);

    // Call Gemini API
    const response = await callGeminiAPI(prompt);

    // Parse and validate response
    const productData = parseGeminiResponse(response);

    // Validate extracted data
    const validation = validateExtraction(productData);

    if (!validation.valid) {
      console.warn('Low confidence extraction:', validation);
    }

    return {
      ...productData,
      confidence: validation.confidence,
      extractedAt: Date.now(),
      source: url
    };

  } catch (error) {
    console.error('Extraction failed:', error);
    throw error;
  }
}

/**
 * Clean HTML to reduce token usage
 * @param {string} html - Raw HTML
 * @returns {string} Cleaned HTML
 */
function cleanHtml(html) {
  // Remove scripts, styles, and comments
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Keep only relevant sections (product info usually in main/article/div with product class)
  const relevantSections = [
    /<main[^>]*>[\s\S]*?<\/main>/gi,
    /<article[^>]*>[\s\S]*?<\/article>/gi,
    /<div[^>]*class="[^"]*product[^"]*"[^>]*>[\s\S]*?<\/div>/gi
  ];

  let extracted = '';
  for (const pattern of relevantSections) {
    const matches = cleaned.match(pattern);
    if (matches) {
      extracted += matches.join('\n');
    }
  }

  // If no relevant sections found, use first 50KB of HTML
  if (!extracted) {
    extracted = cleaned.substring(0, 50000);
  }

  // Truncate to 40KB to stay within token limits
  return extracted.substring(0, 40000);
}

/**
 * Build extraction prompt for Gemini
 * @param {string} html - Cleaned HTML
 * @param {string} url - Page URL
 * @returns {string} Prompt text
 */
function buildExtractionPrompt(html, url) {
  return `You are a product data extraction expert. Analyze the provided HTML from ${url} and extract product information.

Extract the following fields:
1. title - Full product name (string)
2. price - Current price (number only, no currency symbols)
3. currency - Currency code (INR, USD, EUR, GBP, CAD, etc.)
4. originalPrice - Original price before discount (number or null)
5. discount - Discount percentage (number or null)
6. stock - Stock status: "in_stock", "out_of_stock", or "limited_stock"
7. rating - Product rating 0-5 (number or null)
8. reviewCount - Number of reviews (number or null)
9. reviews - List of top 3 visible review texts (array of objects {content, author, rating}) or empty array
10. seller - Seller/brand name (string or null)
11. image - Product image URL (string or null)

CRITICAL RULES:
- Return ONLY valid JSON, no markdown, no explanation
- Use null for missing fields
- Extract numbers without currency symbols (₹48,990 → 48990)
- Remove commas from numbers (48,990 → 48990)
- Be precise and accurate
- If you cannot find a field with confidence, use null

HTML Content:
${html}

Return ONLY this JSON format:
{
  "title": "string",
  "price": number,
  "currency": "string",
  "originalPrice": number | null,
  "discount": number | null,
  "stock": "in_stock" | "out_of_stock" | "limited_stock",
  "rating": number | null,
  "reviewCount": number | null,
  "reviews": [{"content": "string", "author": "string", "rating": number}],
  "seller": "string" | null,
  "image": "string" | null
}`;
}

/**
 * Call Gemini Pro API
 * @param {string} prompt - Extraction prompt
 * @returns {Promise<Object>} API response
 */
async function callGeminiAPI(prompt) {
  const maxRetries = Config.MAX_RETRIES;
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(`${Config.GEMINI_API_URL}?key=${Config.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.1, // Low temperature for consistent extraction
            maxOutputTokens: 1024
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      lastError = error;
      console.warn(`Gemini API attempt ${attempt + 1} failed:`, error);

      if (attempt < maxRetries - 1) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, Config.RETRY_DELAY));
      }
    }
  }

  throw new Error(`Gemini API failed after ${maxRetries} attempts: ${lastError.message}`);
}

/**
 * Parse Gemini response and extract JSON
 * @param {Object} response - Gemini API response
 * @returns {Object} Parsed product data
 */
function parseGeminiResponse(response) {
  try {
    // Extract text from response
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No text in Gemini response');
    }

    // Remove markdown code blocks if present
    let jsonText = text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }

    // Parse JSON
    const productData = JSON.parse(jsonText);

    return productData;

  } catch (error) {
    console.error('Failed to parse Gemini response:', error);
    console.error('Response:', response);
    throw new Error('Failed to parse product data from AI response');
  }
}

/**
 * Validate extracted product data
 * @param {Object} data - Extracted product data
 * @returns {Object} Validation result with confidence score
 */
function validateExtraction(data) {
  const checks = {
    title: data.title && typeof data.title === 'string' && data.title.length > 5,
    price: data.price && typeof data.price === 'number' && data.price > 0,
    currency: data.currency && ['INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD'].includes(data.currency),
    stock: data.stock && ['in_stock', 'out_of_stock', 'limited_stock'].includes(data.stock)
  };

  // Calculate confidence score
  const passedChecks = Object.values(checks).filter(Boolean).length;
  const confidence = passedChecks / Object.keys(checks).length;

  return {
    valid: confidence >= 0.75, // Need at least 75% confidence
    confidence: confidence,
    checks: checks,
    issues: Object.entries(checks)
      .filter(([_, passed]) => !passed)
      .map(([field]) => field)
  };
}

/**
 * Extract product data with retry logic
 * @param {string} html - Page HTML
 * @param {string} url - Page URL
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<Object>} Extracted product data
 */
async function extractWithRetry(html, url, maxRetries = 2) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await extractProductData(html, url);

      // If confidence is too low, retry
      if (result.confidence < 0.75 && attempt < maxRetries - 1) {
        console.warn(`Low confidence (${result.confidence}), retrying...`);
        continue;
      }

      return result;

    } catch (error) {
      lastError = error;
      console.warn(`Extraction attempt ${attempt + 1} failed:`, error);

      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  throw new Error(`Extraction failed after ${maxRetries} attempts: ${lastError.message}`);
}

/**
 * Extract the best matching product URL from search results HTML
 * @param {string} html - Search result page HTML
 * @param {string} searchUrl - context URL
 * @param {Object} targetProduct - The product we are looking for (title, price, attributes)
 * @returns {Promise<string|null>} URL of the best matching product or null
 */
async function extractBestMatchFromSearchResults(html, searchUrl, targetProduct) {
  try {
    if (!Config.isConfigured()) return null;

    const cleanedHtml = cleanHtml(html);

    const prompt = `
You are a smart shopping assistant. I am looking for a specific product on this e-commerce search results page.
Your task is to find the URL of the product that BEST matches my target product.

Target Product Details:
- Title: ${targetProduct.title}
- Price: ~${targetProduct.priceValue || 'Unknown'} (Currency: ${targetProduct.currency || 'Unknown'})
- Brand: ${targetProduct.brand || 'Unknown'}
- Important Attributes: ${targetProduct.attributes ? JSON.stringify(targetProduct.attributes) : 'Color, RAM, Storage (exact match preferred)'}

Search Results Layout HTML:
${cleanedHtml}

INSTRUCTIONS:
1. Analyze the HTML to find product listings.
2. Compare each listing with the Target Product.
3. Prioritize matches with the SAME Color, RAM, and Storage if specified in the target title.
4. If multiple variants exist, pick the specific variant that matches the target.
5. Ignore sponsored products if a better organic match exists.
6. Return ONLY the absolute URL of the best matching product.
7. If the URL is relative, prepend the domain from "${searchUrl}".
8. If no good match is found, return null.

Response Format:
Return ONLY the URL string, or "null" (without quotes) if no match. Do not explanations.
`;

    const response = await callGeminiAPI(prompt);
    const resultUrl = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!resultUrl || resultUrl.toLowerCase() === 'null') {
      return null;
    }

    // Clean URL (remove markdown if any)
    let cleanUrl = resultUrl.replace(/`/g, '');

    // Ensure absolute URL
    try {
      // If it's already absolute (starts with http), this works.
      // If it's relative (e.g., /dp/B0123), it throws.
      new URL(cleanUrl);
    } catch (e) {
      // It's likely relative, resolve against searchUrl
      try {
        const baseUrl = new URL(searchUrl);
        cleanUrl = new URL(cleanUrl, baseUrl.origin).href;
      } catch (err) {
        console.warn('Failed to resolve relative URL:', cleanUrl);
        // Fallback: simpler concatenation if base resolution fails
        if (cleanUrl.startsWith('/')) {
          const origin = new URL(searchUrl).origin;
          cleanUrl = origin + cleanUrl;
        }
      }
    }

    return cleanUrl;

  } catch (error) {
    console.error('Failed to extract best match from search results:', error);
    return null;
  }
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractProductData,
    extractWithRetry,
    validateExtraction,
    extractBestMatchFromSearchResults
  };
}
