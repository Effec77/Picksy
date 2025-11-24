// content.js
// Safe content script: responds to PICKSY_SCRAPE and returns a product object.
// Keeps messaging exactly like before to avoid connection issues.

// ---------------- TITLE ----------------
function simpleTitle() {
  try {
    let title = "";
    let brand = "";
    
    if (location.hostname.includes("amazon")) {
      title = document.querySelector("#productTitle")?.innerText?.trim() || "";
    } else if (location.hostname.includes("flipkart")) {
      title =
        document.querySelector("span.VU-ZEz")?.innerText?.trim() ||
        document.querySelector("._35KyD6")?.innerText?.trim() ||
        "";
    } else if (location.hostname.includes("myntra")) {
      // Myntra has brand and product name in separate elements
      const brandSelectors = [".pdp-title", ".pdp-brand", "h1.pdp-name", ".brand-name", "[data-testid='brand']", ".product-brand"];
      const productSelectors = [".pdp-name", ".product-name", ".pdp-product-name", "h1.product-title", ".product-title", "[data-testid='name']", ".product-productName"];

      let product = "";

      // Find brand
      for (const selector of brandSelectors) {
        const element = document.querySelector(selector);
        if (element && element.innerText?.trim()) {
          brand = element.innerText.trim();
          break;
        }
      }

      // Find product name
      for (const selector of productSelectors) {
        const element = document.querySelector(selector);
        if (element && element.innerText?.trim()) {
          product = element.innerText.trim();
          break;
        }
      }

      // If we couldn't find separate elements, try to get from page title or breadcrumbs
      if (!brand && !product) {
        const breadcrumb = document.querySelector(".breadcrumbs a:last-child, .breadcrumb-item:last-child");
        if (breadcrumb) {
          title = breadcrumb.innerText?.trim() || "";
        }
      } else {
        // Combine brand and product name
        if (brand && product && brand !== product) {
          title = `${brand} ${product}`;
        } else {
          title = brand || product || "";
        }
      }

      console.log("🔍 Myntra title extraction:", { brand, product, combined: title });
    } else {
      // Generic extraction for other websites
      // Try to find brand first
      const brandSelectors = [
        '[itemprop="brand"]',
        '.brand',
        '.product-brand',
        '[class*="brand"]',
        '[data-brand]',
        '.manufacturer'
      ];
      
      for (const selector of brandSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          brand = element.innerText?.trim() || element.getAttribute('content') || element.getAttribute('data-brand') || '';
          if (brand) break;
        }
      }

      // Try to find product name
      const productSelectors = [
        'h1[itemprop="name"]',
        '.product-title',
        '.product-name',
        'h1.title',
        '[class*="product-title"]',
        '[class*="product-name"]',
        'h1'
      ];

      for (const selector of productSelectors) {
        const element = document.querySelector(selector);
        if (element && element.innerText?.trim()) {
          const productName = element.innerText.trim();
          // Combine brand and product if both exist
          if (brand && !productName.toLowerCase().includes(brand.toLowerCase())) {
            title = `${brand} ${productName}`;
          } else {
            title = productName;
          }
          break;
        }
      }

      console.log("🔍 Generic title extraction:", { brand, title });
    }

    // Fallback to meta tags and page title
    if (!title) {
      const og = document.querySelector('meta[property="og:title"]')?.content;
      const tw = document.querySelector('meta[name="twitter:title"]')?.content;
      const h1 = document.querySelector("h1")?.innerText?.trim();
      const titleTag = document.title;
      
      title = og?.trim() || tw?.trim() || h1 || titleTag || "";
      
      // If we have a brand but title doesn't include it, prepend it
      if (brand && title && !title.toLowerCase().includes(brand.toLowerCase())) {
        title = `${brand} ${title}`;
      }
    }

    // Final check: if still no brand in title, try to extract from domain for official sites
    if (title && !brand) {
      const hostname = location.hostname.replace('www.', '');
      const domainBrand = hostname.split('.')[0];
      
      // Check if this looks like a brand name (not generic like 'shop', 'store', etc.)
      const genericWords = ['shop', 'store', 'buy', 'online', 'ecommerce', 'cart'];
      if (!genericWords.includes(domainBrand.toLowerCase()) && 
          !title.toLowerCase().includes(domainBrand.toLowerCase())) {
        // Capitalize first letter of each word
        const formattedBrand = domainBrand
          .split(/(?=[A-Z])/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        title = `${formattedBrand} ${title}`;
        console.log("🔍 Added brand from domain:", formattedBrand);
      }
    }

    console.log("🔍 Final title:", title);
    return title;
  } catch (e) {
    console.warn("simpleTitle error", e);
    return document.title || "";
  }
}

// ---------------- CURRENCY DETECTION ----------------
function detectWebsiteCurrency() {
  const hostname = location.hostname.toLowerCase();

  // Domain-based detection
  if (hostname.includes('amazon.com') || hostname.includes('amazon.us')) return 'USD';
  if (hostname.includes('amazon.co.uk')) return 'GBP';
  if (hostname.includes('amazon.de')) return 'EUR';
  if (hostname.includes('amazon.fr')) return 'EUR';
  if (hostname.includes('amazon.it')) return 'EUR';
  if (hostname.includes('amazon.es')) return 'EUR';
  if (hostname.includes('amazon.ca')) return 'CAD';
  if (hostname.includes('amazon.in') || hostname.includes('flipkart') || hostname.includes('myntra')) return 'INR';

  // Check for currency symbols in page content
  const bodyText = document.body?.innerText || '';
  if (bodyText.includes('$') && !bodyText.includes('₹')) return 'USD';
  if (bodyText.includes('£')) return 'GBP';
  if (bodyText.includes('€')) return 'EUR';
  if (bodyText.includes('₹')) return 'INR';

  // Check meta tags for currency
  const currencyMeta = document.querySelector('meta[name="currency"], meta[property="product:price:currency"]');
  if (currencyMeta) {
    const currency = currencyMeta.content?.toUpperCase();
    if (['USD', 'EUR', 'GBP', 'INR', 'CAD'].includes(currency)) return currency;
  }

  // Default fallback
  return 'USD';
}

// ---------------- PRICE HELPERS ----------------
function parsePriceToNumber(str, sourceCurrency = 'USD') {
  if (!str) return null;
  const s = String(str).toLowerCase().trim();

  console.log("🔍 Parsing price:", str, "→", s);

  // Indian specific formats (lakh/crore)
  if (sourceCurrency === 'INR') {
    const lakh = s.match(/([\d.]+)\s*(lakh|lac)\b/);
    if (lakh) {
      const v = parseFloat(lakh[1]);
      console.log("📊 Found lakh format:", lakh[1], "→", v * 100000);
      return isNaN(v) ? null : Math.round(v * 100000);
    }
    const crore = s.match(/([\d.]+)\s*crore\b/);
    if (crore) {
      const v = parseFloat(crore[1]);
      console.log("📊 Found crore format:", crore[1], "→", v * 10000000);
      return isNaN(v) ? null : Math.round(v * 10000000);
    }
  }

  // Remove currency symbols first
  let cleaned = s.replace(/[₹$€£]/g, '');
  
  // Extract the longest sequence of digits (with optional commas, spaces, and one decimal point)
  // This matches patterns like: "3,995.00", "3 995.00", "3995.00", "3995"
  const pricePatterns = [
    /(\d[\d\s,]*\d\.\d{2})/,  // Match: 3,995.00 or 3 995.00 (with decimal)
    /(\d[\d\s,]*\d)/,          // Match: 3,995 or 3 995 (without decimal)
    /(\d+\.\d{2})/,            // Match: 995.00 (simple decimal)
    /(\d+)/                    // Match: 995 (simple number)
  ];

  for (const pattern of pricePatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      // Remove ALL spaces and commas, keep only digits and dots
      let numStr = match[1].replace(/[\s,]/g, "");
      const num = parseFloat(numStr);
      
      // Validate: price should be reasonable (between 1 and 10 million)
      if (!isNaN(num) && num >= 1 && num <= 10000000) {
        console.log("💰 Cleaned price:", str, "→", match[1], "→", numStr, "→", num);
        return Math.round(num);
      }
    }
  }

  console.log("❌ Could not parse price from:", str);
  return null;
}

function formatINR(num, compact = true) {
  if (num == null) return "";
  try {
    if (compact) {
      if (num >= 10000000) {
        // Crore (1 crore = 10,000,000)
        const crores = (num / 10000000).toFixed(2);
        return "₹" + (crores.endsWith('.00') ? crores.slice(0, -3) : crores.replace(/\.?0+$/, '')) + "Cr";
      } else if (num >= 100000) {
        // Lakh (1 lakh = 100,000)
        const lakhs = (num / 100000).toFixed(2);
        return "₹" + (lakhs.endsWith('.00') ? lakhs.slice(0, -3) : lakhs.replace(/\.?0+$/, '')) + "L";
      } else if (num >= 1000) {
        // Thousands (K)
        const thousands = (num / 1000).toFixed(1);
        return "₹" + (thousands.endsWith('.0') ? thousands.slice(0, -2) : thousands) + "K";
      }
    }
    return "₹" + Number(num).toLocaleString("en-IN");
  } catch {
    return "₹" + num;
  }
}

function formatUSD(num, compact = true) {
  if (num == null) return "";
  try {
    if (compact && num >= 1000) {
      if (num >= 1000000) {
        const millions = (num / 1000000).toFixed(1);
        return "$" + (millions.endsWith('.0') ? millions.slice(0, -2) : millions) + "M";
      } else if (num >= 1000) {
        const thousands = (num / 1000).toFixed(1);
        return "$" + (thousands.endsWith('.0') ? thousands.slice(0, -2) : thousands) + "K";
      }
    }
    return "$" + Number(num).toLocaleString("en-US");
  } catch {
    return "$" + num;
  }
}

function formatEUR(num, compact = true) {
  if (num == null) return "";
  try {
    if (compact && num >= 1000) {
      if (num >= 1000000) {
        const millions = (num / 1000000).toFixed(1);
        return "€" + (millions.endsWith('.0') ? millions.slice(0, -2) : millions) + "M";
      } else if (num >= 1000) {
        const thousands = (num / 1000).toFixed(1);
        return "€" + (thousands.endsWith('.0') ? thousands.slice(0, -2) : thousands) + "K";
      }
    }
    return "€" + Number(num).toLocaleString("de-DE");
  } catch {
    return "€" + num;
  }
}

function formatGBP(num, compact = true) {
  if (num == null) return "";
  try {
    if (compact && num >= 1000) {
      if (num >= 1000000) {
        const millions = (num / 1000000).toFixed(1);
        return "£" + (millions.endsWith('.0') ? millions.slice(0, -2) : millions) + "M";
      } else if (num >= 1000) {
        const thousands = (num / 1000).toFixed(1);
        return "£" + (thousands.endsWith('.0') ? thousands.slice(0, -2) : thousands) + "K";
      }
    }
    return "£" + Number(num).toLocaleString("en-GB");
  } catch {
    return "£" + num;
  }
}

function formatCAD(num, compact = true) {
  if (num == null) return "";
  try {
    if (compact && num >= 1000) {
      if (num >= 1000000) {
        const millions = (num / 1000000).toFixed(1);
        return "C$" + (millions.endsWith('.0') ? millions.slice(0, -2) : millions) + "M";
      } else if (num >= 1000) {
        const thousands = (num / 1000).toFixed(1);
        return "C$" + (thousands.endsWith('.0') ? thousands.slice(0, -2) : thousands) + "K";
      }
    }
    return "C$" + Number(num).toLocaleString("en-CA");
  } catch {
    return "C$" + num;
  }
}

function formatPrice(num, currency = 'USD', compact = true) {
  switch (currency) {
    case 'USD': return formatUSD(num, compact);
    case 'EUR': return formatEUR(num, compact);
    case 'GBP': return formatGBP(num, compact);
    case 'CAD': return formatCAD(num, compact);
    case 'INR': return formatINR(num, compact);
    default: return formatUSD(num, compact);
  }
}

function isStruckThrough(el) {
  try {
    const cs = window.getComputedStyle(el);
    const deco = cs.getPropertyValue("text-decoration") || "";
    return deco.includes("line-through");
  } catch {
    return false;
  }
}

function scorePriceElement(el, value) {
  let score = 0;
  const lc = ((el.id || "") + " " + (el.className || "")).toLowerCase();
  const text = el.innerText?.toLowerCase() || '';

  // Positive signals (sale/final price)
  if (/(priceblock|dealprice|ourprice|pricetopay|a-offscreen|selling|final|pay|discount-price|sale|offer|current)/.test(lc)) score += 4;
  
  // Negative signals (original/MRP price)
  if (/(mrp|strike|strikethrough|was-price|scratch|original|regular)/.test(lc)) score -= 5;
  if (isStruckThrough(el)) score -= 6;
  
  // Check if text contains "MRP" or "Was" (likely original price)
  if (text.includes('mrp') || text.includes('was') || text.includes('original')) score -= 4;
  
  // Prefer reasonable prices
  if (value >= 1000 && value <= 20000) score += 2; // Sweet spot for shoes
  if (value >= 20000) score -= 2; // Too high, likely MRP
  if (value <= 500) score -= 3; // Too low, likely not main price

  return score;
}

function collectCandidateNodes() {
  const selectors = [
    // Amazon
    "#corePrice_feature_div .a-price .a-offscreen",
    ".a-price .a-offscreen",
    "#priceblock_dealprice",
    "#priceblock_ourprice",
    "#tp_price_block_total_price_ww",
    "#newBuyBoxPrice",
    // Flipkart
    "div.Nx9bqj.CxhGGd",
    "._30jeq3",
    "._16Jk6d",
    // Myntra
    ".pdp-discount-price",
    ".pdp-price",
    // Generic
    '[class*="price"]',
    '[id*="price"]'
  ];

  const set = new Set();
  const nodes = [];
  selectors.forEach((sel) => {
    try {
      document.querySelectorAll(sel).forEach((el) => {
        if (el && !set.has(el)) {
          set.add(el);
          nodes.push(el);
        }
      });
    } catch (e) {
      // ignore selector error
    }
  });
  return nodes;
}

function extractPrice() {
  try {
    // Detect currency once at the top of the function
    const detectedCurrency = detectWebsiteCurrency();

    // site-specific quick checks
    if (location.hostname.includes("amazon")) {
      const order = [
        "#corePrice_feature_div .a-price .a-offscreen",
        ".a-price .a-offscreen",
        "#priceblock_dealprice",
        "#priceblock_ourprice",
        "#tp_price_block_total_price_ww",
        "#newBuyBoxPrice"
      ];
      for (const sel of order) {
        const element = document.querySelector(sel);
        const t = element?.innerText?.trim();
        console.log(`🔍 Amazon selector ${sel}:`, t, element);
        const v = parsePriceToNumber(t, detectedCurrency);
        if (v) {
          console.log(`✅ Found price via ${sel}:`, t, "→", v, "→", formatPrice(v, detectedCurrency));
          return { display: formatPrice(v, detectedCurrency), value: v, via: `amazon:${sel}` };
        }
      }
    } else if (location.hostname.includes("flipkart")) {
      const order = ["div.Nx9bqj.CxhGGd", "._30jeq3", "._16Jk6d"];
      for (const sel of order) {
        const t = document.querySelector(sel)?.innerText?.trim();
        const v = parsePriceToNumber(t, detectedCurrency);
        if (v) return { display: formatPrice(v, detectedCurrency), value: v, via: `flipkart:${sel}` };
      }
    } else if (location.hostname.includes("myntra")) {
      const order = [".pdp-discount-price", ".pdp-price"];
      for (const sel of order) {
        const t = document.querySelector(sel)?.innerText?.trim();
        const v = parsePriceToNumber(t, detectedCurrency);
        if (v) return { display: formatPrice(v, detectedCurrency), value: v, via: `myntra:${sel}` };
      }
    } else if (location.hostname.includes("nike")) {
      // Nike-specific price extraction
      console.log("🔍 Nike price extraction starting...");
      
      const order = [
        '[data-test="product-price"]',
        '[class*="product-price"]',
        'div[class*="currentPrice"]',
        'div[class*="price-"]',
        '.product-price'
      ];
      
      for (const sel of order) {
        const elements = document.querySelectorAll(sel);
        console.log(`🔍 Nike selector ${sel}: found ${elements.length} elements`);
        
        for (const element of elements) {
          const t = element?.innerText?.trim();
          console.log(`  - Text:`, t);
          
          if (t && t.length > 2) { // Avoid single digits
            const v = parsePriceToNumber(t, detectedCurrency);
            if (v && v > 100) { // Sanity check: price should be > 100
              console.log(`✅ Found Nike price via ${sel}:`, t, "→", v);
              return { display: formatPrice(v, detectedCurrency), value: v, via: `nike:${sel}` };
            }
          }
        }
      }
      
      // Fallback: Look for MRP text (handle spaces in numbers like "3 995.00")
      const bodyText = document.body.innerText;
      
      // Try to find MRP with proper context (not just any number)
      const mrpMatches = bodyText.match(/MRP\s*[:\-]?\s*₹\s*([\d\s,]+(?:\.\d{1,2})?)/gi);
      if (mrpMatches && mrpMatches.length > 0) {
        // Take the first MRP match (usually the main product price)
        const mrpMatch = mrpMatches[0].match(/₹\s*([\d\s,]+(?:\.\d{1,2})?)/i);
        if (mrpMatch) {
          console.log(`🔍 Found MRP match:`, mrpMatches[0], "→ Extracted:", mrpMatch[1]);
          const v = parsePriceToNumber(mrpMatch[1], detectedCurrency);
          if (v && v > 100 && v < 1000000) { // Sanity check: between 100 and 1M
            console.log(`✅ Found Nike price via MRP text:`, mrpMatches[0], "→", v);
            return { display: formatPrice(v, detectedCurrency), value: v, via: `nike:mrp-text` };
          } else {
            console.log(`⚠️ Price out of range:`, v);
          }
        }
      }
    } else if (location.hostname.includes("adidas")) {
      // Adidas-specific price extraction
      console.log("🔍 Adidas price extraction starting...");
      
      const order = [
        '[data-auto-id="product-price"]',
        '.gl-price',
        '[class*="price"]',
        '[data-testid="product-price"]'
      ];
      
      for (const sel of order) {
        const elements = document.querySelectorAll(sel);
        console.log(`🔍 Adidas selector ${sel}: found ${elements.length} elements`);
        
        for (const element of elements) {
          const t = element?.innerText?.trim();
          console.log(`  - Text:`, t);
          
          if (t && t.length > 1 && t.length < 50) {
            const v = parsePriceToNumber(t, detectedCurrency);
            if (v && v > 100) {
              console.log(`✅ Found Adidas price via ${sel}:`, t, "→", v);
              return { display: formatPrice(v, detectedCurrency), value: v, via: `adidas:${sel}` };
            }
          }
        }
      }
    } else if (location.hostname.includes("puma")) {
      // Puma-specific price extraction
      console.log("🔍 Puma price extraction starting...");
      
      // Try to find the main product price container first
      const priceContainers = [
        '[class*="product-price"]',
        '[class*="productPrice"]',
        '[data-test*="price"]',
        '.price-container',
        '.product-info'
      ];
      
      for (const containerSel of priceContainers) {
        const container = document.querySelector(containerSel);
        if (container) {
          console.log(`🔍 Found price container:`, containerSel);
          
          // Look for prices within this container
          const priceElements = container.querySelectorAll('[class*="price"], [data-test*="price"]');
          const prices = [];
          
          priceElements.forEach(el => {
            const text = el.innerText?.trim();
            if (text && text.length < 50 && !text.toLowerCase().includes('mrp') && !text.toLowerCase().includes('was')) {
              const v = parsePriceToNumber(text, detectedCurrency);
              if (v && v > 500 && v < 50000) {
                prices.push({ value: v, text: text, element: el });
                console.log(`  - Found price in container:`, text, "→", v);
              }
            }
          });
          
          if (prices.length > 0) {
            // Pick the lowest price (sale price)
            prices.sort((a, b) => a.value - b.value);
            const chosen = prices[0];
            console.log(`✅ Chosen Puma price from container:`, chosen.text, "→", chosen.value);
            return { display: formatPrice(chosen.value, detectedCurrency), value: chosen.value, via: `puma:container` };
          }
        }
      }
      
      console.log("⚠️ Puma: No price found in containers, falling back to generic extraction");
    }

    // scored candidate search
    const candidates = [];
    const freq = new Map();

    collectCandidateNodes().forEach((el) => {
      try {
        const txt = el.innerText?.trim();
        if (!txt || txt.length > 100) return; // Skip very long text (likely not a price)

        // Multi-currency price pattern matching (more flexible)
        const patterns = [
          /(₹\s?[\d\s,]+(?:\.\d{1,2})?)/i,  // INR (with spaces)
          /(\$\s?[\d\s,]+(?:\.\d{1,2})?)/i,  // USD (with spaces)
          /(€\s?[\d\s,]+(?:\.\d{1,2})?)/i,   // EUR (with spaces)
          /(£\s?[\d\s,]+(?:\.\d{1,2})?)/i,   // GBP (with spaces)
          /(C\$\s?[\d\s,]+(?:\.\d{1,2})?)/i, // CAD (with spaces)
          /([\d\s,]+(?:\.\d{1,2})?\s?(inr|usd|eur|gbp|cad))/i // Text format
        ];

        let match = null;
        for (const pattern of patterns) {
          match = txt.match(pattern);
          if (match) break;
        }

        if (!match) return;
        const v = parsePriceToNumber(match[0], detectedCurrency);
        if (!v || v < 10) return; // Skip prices less than 10 (likely not real prices)

        freq.set(v, (freq.get(v) || 0) + 1);
        candidates.push({
          el,
          value: v,
          baseScore: scorePriceElement(el, v),
          text: txt.substring(0, 50) // Store text for debugging
        });
      } catch (e) {
        /* ignore per node */
      }
    });

    if (candidates.length) {
      candidates.forEach((c) => {
        const repeatBonus = Math.min(freq.get(c.value) || 1, 5) * 1.5;
        c.total = c.baseScore + repeatBonus;
      });
      
      // Sort by score
      candidates.sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.value - b.value; // Prefer lower price if same score
      });
      
      // Log all candidates for debugging
      console.log("📊 All price candidates:", candidates.map(c => ({
        price: c.value,
        score: c.total,
        text: c.text
      })));
      
      // Filter out likely MRP/original prices (negative scores)
      const validCandidates = candidates.filter(c => c.total > 0);
      
      if (validCandidates.length > 0) {
        // For e-commerce sites, prefer the LOWEST price among valid candidates
        // (sale price is always lower than MRP)
        validCandidates.sort((a, b) => a.value - b.value);
        const chosen = validCandidates[0];
        console.log(`✅ Chosen LOWEST price from ${validCandidates.length} valid candidates:`, chosen.value, "Score:", chosen.total);
        return { display: formatPrice(chosen.value, detectedCurrency), value: chosen.value, via: "scored-candidates-lowest" };
      } else if (candidates.length > 0) {
        // All candidates have negative scores, pick the lowest price
        candidates.sort((a, b) => a.value - b.value);
        const chosen = candidates[0];
        console.log(`⚠️ All candidates have negative scores, picking LOWEST:`, chosen.value, "Score:", chosen.total);
        return { display: formatPrice(chosen.value, detectedCurrency), value: chosen.value, via: "scored-candidates-fallback-lowest" };
      }
    }

    // final fallback: largest price amount in body
    const text = document.body.innerText || "";

    const currencyPatterns = [
      /₹\s?[\d,]+(?:\.\d{1,2})?/g,
      /\$\s?[\d,]+(?:\.\d{1,2})?/g,
      /€\s?[\d,]+(?:\.\d{1,2})?/g,
      /£\s?[\d,]+(?:\.\d{1,2})?/g,
      /C\$\s?[\d,]+(?:\.\d{1,2})?/g
    ];

    let allPrices = [];
    currencyPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) allPrices = allPrices.concat(matches);
    });

    if (allPrices.length) {
      const nums = allPrices.map((s) => parsePriceToNumber(s, detectedCurrency)).filter(Boolean);
      if (nums.length) {
        const best = Math.max(...nums);
        return { display: formatPrice(best, detectedCurrency), value: best, via: "body-fallback" };
      }
    }
  } catch (e) {
    console.warn("extractPrice error", e);
  }

  return { display: "", value: null, via: "none" };
}

// ---------------- AVAILABILITY ----------------
const OOS_PATTERNS = [
  "out of stock", "sold out", "currently unavailable", "temporarily out of stock",
  "coming soon", "notify me", "unavailable"
];
const INSTOCK_PATTERNS = [
  "in stock", "only", "left in stock", "available", "add to cart", "add to bag", "buy now", "deliver"
];

function textIncludes(el, phrases) {
  try {
    const t = (el?.innerText || "").toLowerCase();
    return phrases.some((p) => t.includes(p));
  } catch {
    return false;
  }
}

function detectAvailability() {
  try {
    console.log("🔍 detectAvailability called for:", location.hostname);
    
    // Amazon
    if (location.hostname.includes("amazon")) {
      const avail = document.querySelector("#availability");
      if (avail) {
        const t = avail.innerText.toLowerCase();
        if (t.includes("in stock")) return { status: "InStock", reason: "#availability: in stock" };
        if (t.includes("currently unavailable") || t.includes("temporarily out of stock"))
          return { status: "OutOfStock", reason: "#availability: unavailable" };
      }
      const buyNow = document.querySelector("#buy-now-button");
      const addToCart = document.querySelector("#add-to-cart-button");
      if (buyNow || addToCart) {
        const disabled = (buyNow && buyNow.disabled) || (addToCart && addToCart.disabled);
        if (!disabled) return { status: "InStock", reason: "amazon: actionable buttons" };
      }
    }

    // Flipkart
    if (location.hostname.includes("flipkart")) {
      const soldOut = Array.from(document.querySelectorAll("button, div, span"))
        .some((el) => /sold out|out of stock/i.test(el.innerText || ""));
      if (soldOut) return { status: "OutOfStock", reason: "flipkart: sold out text" };

      const addBtn = Array.from(document.querySelectorAll("button, a"))
        .find((el) => /add to cart|buy now/i.test(el.innerText || ""));
      if (addBtn && !addBtn.disabled) return { status: "InStock", reason: "flipkart: add/buy button" };
    }

    // Myntra
    if (location.hostname.includes("myntra")) {
      const oos = document.querySelector(".pdp-out-of-stock, .oos-label");
      if (oos || textIncludes(document.body, ["out of stock", "sold out"])) {
        return { status: "OutOfStock", reason: "myntra: oos label/text" };
      }
      const addBag = document.querySelector(".pdp-add-to-bag, .pdp-add-to-bag-button, .pdp-buy-now");
      if (addBag && !addBag.disabled) return { status: "InStock", reason: "myntra: add to bag" };
    }

    // Nike - Check size/variant availability
    if (location.hostname.includes("nike")) {
      console.log("🔍 Nike stock detection starting...");
      
      // PRIORITY 1: Check for "Just a few left" or similar text (most reliable)
      const bodyText = document.body.innerText.toLowerCase();
      if (bodyText.includes('just a few left') || bodyText.includes('order soon') || bodyText.includes('low stock')) {
        console.log("✅ Found 'just a few left' text - product is in stock");
        return { status: "InStock", reason: "nike: low stock warning (still available)" };
      }
      
      // PRIORITY 2: Check if "Add to Bag" button exists and is enabled
      const addToBagButtons = Array.from(document.querySelectorAll('button, a'));
      const addToBag = addToBagButtons.find(btn => {
        const text = btn.innerText?.toLowerCase() || '';
        const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
        return text.includes('add to bag') || 
               text.includes('add to cart') || 
               ariaLabel.includes('add to bag') ||
               ariaLabel.includes('add to cart');
      });
      
      if (addToBag) {
        const isDisabled = addToBag.disabled || 
                          addToBag.getAttribute('aria-disabled') === 'true' ||
                          addToBag.getAttribute('disabled') !== null;
        console.log("🔍 Add to bag button found:", addToBag.innerText, "- Disabled:", isDisabled);
        if (!isDisabled) {
          return { status: "InStock", reason: "nike: add to bag button enabled" };
        } else {
          return { status: "OutOfStock", reason: "nike: add to bag button disabled" };
        }
      }
      
      // PRIORITY 3: Check size buttons (less reliable due to dynamic styling)
      const sizeInputs = Array.from(document.querySelectorAll('input[type="radio"]'));
      console.log("🔍 Found radio inputs:", sizeInputs.length);
      
      if (sizeInputs.length > 0) {
        let availableCount = 0;
        let unavailableCount = 0;
        
        sizeInputs.forEach(input => {
          const label = input.closest('label');
          if (!label) return;
          
          let isAvailable = true;
          
          // Check if input is explicitly disabled
          if (input.disabled) {
            unavailableCount++;
            return;
          }
          
          // Check aria-disabled
          if (input.getAttribute('aria-disabled') === 'true' || label.getAttribute('aria-disabled') === 'true') {
            unavailableCount++;
            return;
          }
          
          // Check if label has disabled/unavailable in class
          const labelClasses = label.className.toLowerCase();
          if (labelClasses.includes('disabled') || labelClasses.includes('unavailable') || labelClasses.includes('sold-out')) {
            unavailableCount++;
            return;
          }
          
          // If we got here, consider it available
          availableCount++;
        });
        
        console.log(`🔍 Size analysis: ${availableCount} available, ${unavailableCount} unavailable out of ${sizeInputs.length}`);
        
        if (availableCount > 0) {
          return { status: "InStock", reason: `nike: ${availableCount} size(s) available` };
        } else if (unavailableCount === sizeInputs.length) {
          return { status: "OutOfStock", reason: "nike: all sizes unavailable" };
        }
      }
      
      // PRIORITY 4: If we can select a size, assume it's in stock
      if (sizeInputs.length > 0) {
        console.log("✅ Size selection available, assuming in stock");
        return { status: "InStock", reason: "nike: size selection available (assumed in stock)" };
      }
      
      // PRIORITY 5: Check for explicit out of stock messages
      if (bodyText.includes('out of stock') || bodyText.includes('sold out') || bodyText.includes('unavailable')) {
        console.log("❌ Found out of stock text");
        return { status: "OutOfStock", reason: "nike: out of stock text found" };
      }
      
      // PRIORITY 6: If price is shown and no OOS indicators, assume in stock
      console.log("⚠️ Nike: No clear stock indicators, but product page is active - assuming in stock");
      return { status: "InStock", reason: "nike: product page active (assumed in stock)" };
    }

    // Adidas - Check size/variant availability
    if (location.hostname.includes("adidas")) {
      console.log("🔍 Adidas stock detection starting...");
      
      // PRIORITY 1: Check for explicit out of stock messages
      const bodyText = document.body.innerText.toLowerCase();
      if (bodyText.includes('out of stock') || bodyText.includes('sold out') || bodyText.includes('currently unavailable')) {
        console.log("❌ Found out of stock text");
        return { status: "OutOfStock", reason: "adidas: out of stock text found" };
      }
      
      // PRIORITY 2: Check if "Add to Bag" button exists and is enabled
      const addToBagButtons = Array.from(document.querySelectorAll('button, a'));
      const addToBag = addToBagButtons.find(btn => {
        const text = btn.innerText?.toLowerCase() || '';
        const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
        return text.includes('add to bag') || 
               text.includes('add to cart') || 
               text.includes('add to basket') ||
               ariaLabel.includes('add to bag') ||
               ariaLabel.includes('add to cart');
      });
      
      if (addToBag) {
        const isDisabled = addToBag.disabled || 
                          addToBag.getAttribute('aria-disabled') === 'true' ||
                          addToBag.getAttribute('disabled') !== null ||
                          addToBag.classList.contains('disabled');
        console.log("🔍 Add to bag button found:", addToBag.innerText, "- Disabled:", isDisabled);
        if (!isDisabled) {
          return { status: "InStock", reason: "adidas: add to bag button enabled" };
        } else {
          return { status: "OutOfStock", reason: "adidas: add to bag button disabled" };
        }
      }
      
      // PRIORITY 3: Check size buttons
      const sizeButtons = Array.from(document.querySelectorAll('button[class*="size"], [class*="size-selector"] button, [data-auto-id*="size"] button'));
      console.log("🔍 Found size buttons:", sizeButtons.length);
      
      if (sizeButtons.length > 0) {
        const availableSizes = sizeButtons.filter(btn => {
          const isDisabled = btn.disabled || 
                            btn.getAttribute('aria-disabled') === 'true' ||
                            btn.classList.contains('disabled') ||
                            btn.classList.contains('unavailable');
          return !isDisabled;
        });
        
        console.log(`🔍 Available sizes: ${availableSizes.length} out of ${sizeButtons.length}`);
        
        if (availableSizes.length > 0) {
          return { status: "InStock", reason: `adidas: ${availableSizes.length} size(s) available` };
        } else {
          return { status: "OutOfStock", reason: "adidas: all sizes unavailable" };
        }
      }
      
      // PRIORITY 4: If size selection exists, assume in stock
      const sizeSelectors = document.querySelectorAll('select[name*="size"], [class*="size-selector"]');
      if (sizeSelectors.length > 0) {
        console.log("✅ Size selection available, assuming in stock");
        return { status: "InStock", reason: "adidas: size selection available (assumed in stock)" };
      }
      
      // PRIORITY 5: Default - if product page is active with price, assume in stock
      console.log("⚠️ Adidas: No clear stock indicators, but product page is active - assuming in stock");
      return { status: "InStock", reason: "adidas: product page active (assumed in stock)" };
    }

    // Generic size/variant detection for other sites (not Nike, already handled above)
    if (!location.hostname.includes("nike")) {
      try {
        const variantSelectors = [
          'input[type="radio"]:not([disabled])',
          'button[class*="size"]:not([disabled])',
          'button[class*="variant"]:not([disabled])'
        ];
        
        for (const selector of variantSelectors) {
          const availableVariants = document.querySelectorAll(selector);
          if (availableVariants.length > 0) {
            return { status: "InStock", reason: `generic: ${availableVariants.length} variant(s) available` };
          }
        }
        
        // Check select dropdowns separately
        const sizeSelects = document.querySelectorAll('select[name*="size"], select[name*="variant"]');
        for (const select of sizeSelects) {
          const availableOptions = Array.from(select.options).filter(opt => !opt.disabled);
          if (availableOptions.length > 0) {
            return { status: "InStock", reason: `generic: ${availableOptions.length} size option(s) available` };
          }
        }
      } catch (e) {
        console.warn("Generic variant detection error:", e);
      }
    }

    // Heuristic near action areas
    const actionZones = [
      document.querySelector("#rightCol"),
      document.querySelector("#buybox"),
      document.querySelector("#availability"),
      document.querySelector(".pdp-action-container"),
      document
    ].filter(Boolean);

    for (const zone of actionZones) {
      if (textIncludes(zone, OOS_PATTERNS))
        return { status: "OutOfStock", reason: "heuristic: oos phrase in action zone" };
      if (textIncludes(zone, INSTOCK_PATTERNS))
        return { status: "InStock", reason: "heuristic: instock phrase in action zone" };
    }
  } catch (e) {
    console.warn("detectAvailability error", e);
  }

  return { status: "Unknown", reason: "no reliable signal" };
}

// ---------------- URL ----------------
function canonicalUrl() {
  try {
    const link = document.querySelector('link[rel="canonical"]');
    return link?.href || location.href;
  } catch {
    return location.href;
  }
}

// ---------------- CROSS-SITE COMPARISON ----------------
function extractProductKeywords(title) {
  if (!title) return [];

  let cleanTitle = title.trim();
  console.log("🔍 Original title:", title);

  // Step 1: Clean the title and extract core information
  let processedTitle = cleanTitle
    .replace(/\([^)]*\)/g, ' ') // Remove parentheses content
    .replace(/\[[^\]]*\]/g, ' ') // Remove bracket content
    .replace(/[^\w\s]/g, ' ') // Replace special chars with spaces
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();

  console.log("🔍 Processed title:", processedTitle);

  // Step 2: Extract brand names (comprehensive list)
  const allBrands = [
    // Tech brands
    'apple', 'samsung', 'oneplus', 'xiaomi', 'oppo', 'vivo', 'realme', 'motorola', 'nokia', 'sony', 'lg', 'huawei', 'honor',
    'asus', 'acer', 'hp', 'dell', 'lenovo', 'msi', 'gigabyte', 'evga', 'corsair', 'cooler master', 'thermaltake',
    'nvidia', 'amd', 'intel', 'western digital', 'seagate', 'kingston', 'crucial', 'sandisk',
    // Fashion brands
    'hrx', 'roadster', 'here&now', 'mast&harbour', 'wrogn', 'nike', 'adidas', 'puma', 'reebok', 'under armour',
    'levis', 'tommy hilfiger', 'calvin klein', 'polo ralph lauren', 'zara', 'h&m', 'maniac', 'bewakoof',
    'the souled store', 'campus sutra', 'being human', 'flying machine', 'pepe jeans', 'spykar',
    // Supplement/Nutrition brands
    'optimum nutrition', 'on', 'myprotein', 'muscleblaze', 'mb', 'dymatize', 'bsn', 'cellucor', 'musclepharm',
    'isopure', 'ultimate nutrition', 'gat', 'labrada', 'mutant', 'nutrex', 'healthkart', 'gnc', 'muscletech'
  ];

  // Step 3: Extract product categories and types
  const productTypes = [
    // Electronics
    'iphone', 'galaxy', 'oneplus', 'pixel', 'macbook', 'thinkpad', 'inspiron', 'xps', 'pavilion', 'ideapad', 'vivobook', 'zenbook',
    'graphics card', 'gpu', 'processor', 'cpu', 'motherboard', 'ram', 'memory', 'ssd', 'hard drive', 'monitor', 'keyboard', 'mouse',
    'rtx', 'gtx', 'radeon', 'ryzen', 'core i3', 'core i5', 'core i7', 'core i9',
    // Fashion
    'shirt', 'tshirt', 't-shirt', 'jeans', 'dress', 'shoes', 'sneakers', 'jacket', 'hoodie', 'sweatshirt', 'kurta', 'saree', 'kurti',
    // Supplements
    'whey protein', 'whey', 'protein', 'creatine', 'bcaa', 'pre workout', 'mass gainer', 'gainer', 'isolate', 'casein',
    'multivitamin', 'omega 3', 'fish oil', 'glutamine', 'amino', 'preworkout', 'fat burner'
  ];

  // Step 4: Extract specifications and key features
  const lowerTitle = processedTitle.toLowerCase();
  const keywords = [];

  // Extract brand (PRIORITY 1)
  let foundBrand = '';
  // Sort brands by length (longer first) to match "optimum nutrition" before "on"
  const sortedBrands = [...allBrands].sort((a, b) => b.length - a.length);
  for (const brand of sortedBrands) {
    if (lowerTitle.includes(brand.toLowerCase())) {
      foundBrand = brand;
      // Capitalize properly
      const capitalizedBrand = brand.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      keywords.push(capitalizedBrand);
      break;
    }
  }

  // Extract product type/model (PRIORITY 2)
  let foundType = '';
  // Sort product types by length (longer first) to match "whey protein" before "whey"
  const sortedTypes = [...productTypes].sort((a, b) => b.length - a.length);
  for (const type of sortedTypes) {
    if (lowerTitle.includes(type.toLowerCase())) {
      foundType = type;
      if (!keywords.some(k => k.toLowerCase() === type.toLowerCase())) {
        keywords.push(type);
      }
      break;
    }
  }

  // Extract model numbers and specifications (PRIORITY 3)
  const specs = [];

  // Weight/Size for supplements (1kg, 2.2lbs, 500g, etc.)
  const weightMatch = lowerTitle.match(/(\d+(?:\.\d+)?)\s*(kg|g|lb|lbs|oz)/gi);
  if (weightMatch && weightMatch.length > 0) {
    const weight = weightMatch[0].replace(/\s+/g, '').toLowerCase();
    specs.push(weight);
  }

  // Storage capacity for electronics
  const storageMatch = lowerTitle.match(/(\d+)\s*(gb|tb)(?!\s*(ram|memory|ddr))/gi);
  if (storageMatch && storageMatch.length > 0) {
    const cleanStorage = storageMatch[0].replace(/\s+/g, '').toUpperCase();
    if (!specs.includes(cleanStorage)) {
      specs.push(cleanStorage);
    }
  }

  // RAM for electronics
  const ramMatch = lowerTitle.match(/(\d+)\s*gb\s*(ram|memory|ddr)/gi);
  if (ramMatch && ramMatch.length > 0) {
    const cleanRam = ramMatch[0].replace(/\s+/g, ' ').trim();
    if (!specs.includes(cleanRam)) {
      specs.push(cleanRam);
    }
  }

  // Model numbers (iPhone 15, Galaxy S24, etc.) - only if not already captured
  if (specs.length === 0) {
    const modelMatch = lowerTitle.match(/(\w+\s*\d+\s*\w*)/g);
    if (modelMatch) {
      modelMatch.slice(0, 1).forEach(model => {
        const cleanModel = model.trim();
        if (cleanModel.length > 2 && !keywords.some(k => k.toLowerCase().includes(cleanModel.toLowerCase()))) {
          specs.push(cleanModel);
        }
      });
    }
  }

  // Add specifications to keywords (PRIORITY 3)
  keywords.push(...specs.slice(0, 2));

  // Step 5: Add ONE important descriptive word if needed (PRIORITY 4)
  const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'under', 'over', 'men', 'women', 'boys', 'girls', 'kids', 'unisex', 'home', 'office', 'gaming', 'mobile', 'phone', 'smartphone', 'laptop', 'computer', 'pc', 'powder', 'product', 'item'];

  let additionalWords = [];
  // Only add descriptive words if we have less than 4 keywords
  if (keywords.length < 4) {
    additionalWords = processedTitle
      .toLowerCase()
      .split(/\s+/)
      .filter(word => {
        return word.length > 4 &&
          !stopWords.includes(word) &&
          !keywords.some(k => k.toLowerCase().includes(word)) &&
          !word.match(/^\d+$/) && // Skip pure numbers
          word.match(/^[a-z]+$/); // Only alphabetic words
      })
      .slice(0, 1); // Only take 1 additional word

    keywords.push(...additionalWords);
  }

  // Step 6: Clean and limit final keywords (max 4 for cleaner search)
  const finalKeywords = keywords
    .filter(k => k && k.length > 1)
    .slice(0, 4);

  console.log("🔍 Smart extraction:", {
    original: title,
    foundBrand,
    foundType,
    specs,
    additionalWords,
    finalKeywords,
    searchQuery: finalKeywords.join(' ')
  });

  return finalKeywords;
}

function generateSearchUrls(keywords, currentSite) {
  if (!keywords.length) return [];

  // Create a more natural search query
  // Order: Brand + Product Type + Specs (e.g., "Optimum Nutrition Whey Protein 1kg")
  // Keywords are already ordered by priority from extraction
  const searchQuery = keywords.join(' ');

  console.log("🔍 Generated search query:", searchQuery, "from keywords:", keywords);

  const urls = [];

  if (!currentSite.includes('amazon.in')) {
    urls.push({
      site: 'Amazon India',
      url: `https://www.amazon.in/s?k=${encodeURIComponent(searchQuery)}&ref=nb_sb_noss`,
      query: searchQuery
    });
  }

  if (!currentSite.includes('flipkart')) {
    urls.push({
      site: 'Flipkart',
      url: `https://www.flipkart.com/search?q=${encodeURIComponent(searchQuery)}&otracker=search&otracker1=search&marketplace=FLIPKART`,
      query: searchQuery
    });
  }

  if (!currentSite.includes('myntra')) {
    // Myntra is mainly for fashion, so only include if it seems like a fashion item
    const fashionKeywords = ['shirt', 'tshirt', 't-shirt', 'jeans', 'dress', 'shoes', 'watch', 'bag', 'jacket', 'hoodie', 'kurta', 'saree', 'kurti', 'hrx', 'roadster', 'sneakers', 'tracksuit', 'joggers'];
    const isFashionItem = keywords.some(keyword =>
      fashionKeywords.some(fashion => keyword.toLowerCase().includes(fashion))
    );

    if (isFashionItem) {
      // Use full search query for better Myntra results
      const myntraQuery = searchQuery.replace(/\s+/g, '-').toLowerCase();
      urls.push({
        site: 'Myntra',
        url: `https://www.myntra.com/search?q=${encodeURIComponent(searchQuery)}`,
        query: searchQuery
      });
    }
  }

  // Add more e-commerce sites for better comparison
  if (!currentSite.includes('croma')) {
    urls.push({
      site: 'Croma',
      url: `https://www.croma.com/search?q=${encodeURIComponent(searchQuery)}`,
      query: searchQuery
    });
  }

  if (!currentSite.includes('vijaysales')) {
    urls.push({
      site: 'Vijay Sales',
      url: `https://www.vijaysales.com/search/${encodeURIComponent(searchQuery)}`,
      query: searchQuery
    });
  }

  console.log("🔍 Generated search URLs:", urls);
  return urls;
}

// ---------------- TRUST SIGNALS ----------------
function isOfficialBrandWebsite() {
  const hostname = location.hostname.toLowerCase();
  
  // List of known official brand domains (match partial domain names)
  const officialBrands = [
    'optimumnutrition',  // matches .com, .in, .co.uk, etc.
    'apple',
    'samsung',
    'nike',
    'adidas',
    'puma',
    'reebok',
    'underarmour',
    'newbalance',
    'dell',
    'hp',
    'lenovo',
    'asus',
    'sony',
    'lg',
    'microsoft',
    'logitech',
    'corsair',
    'razer',
    'myprotein',
    'muscleblaze',
    'healthkart'
  ];
  
  // Check if hostname contains any of these brand names
  // But exclude marketplace sites
  const isMarketplace = hostname.includes('amazon') || 
                        hostname.includes('flipkart') || 
                        hostname.includes('myntra') ||
                        hostname.includes('ebay') ||
                        hostname.includes('alibaba');
  
  if (isMarketplace) return false;
  
  return officialBrands.some(brand => hostname.includes(brand));
}

function extractTrustSignals() {
  const signals = {
    rating: null,
    reviewCount: null,
    seller: null,
    badges: [],
    isOfficialSite: false
  };

  try {
    // Check if this is an official brand website
    signals.isOfficialSite = isOfficialBrandWebsite();
    console.log("🔍 Checking if official site:", location.hostname, "Result:", signals.isOfficialSite);
    
    if (signals.isOfficialSite) {
      // Extract brand name from domain
      const hostname = location.hostname.replace('www.', '');
      const brandName = hostname.split('.')[0];
      signals.seller = brandName.charAt(0).toUpperCase() + brandName.slice(1) + ' Official Store';
      signals.badges.push('Official Brand Website');
      console.log("🏢 Detected official brand website:", signals.seller);
      console.log("🏢 Badges:", signals.badges);
    }

    if (location.hostname.includes("amazon")) {
      // Rating
      const ratingEl = document.querySelector("#acrPopover, .a-icon-star, [data-hook='rating-out-of-text']");
      if (ratingEl) {
        const ratingText = ratingEl.getAttribute('title') || ratingEl.innerText || '';
        const ratingMatch = ratingText.match(/([\d.]+)\s*out of/i);
        if (ratingMatch) signals.rating = parseFloat(ratingMatch[1]);
      }

      // Review count
      const reviewEl = document.querySelector("#acrCustomerReviewText, [data-hook='total-review-count']");
      if (reviewEl) {
        const reviewText = reviewEl.innerText || '';
        const reviewMatch = reviewText.match(/([\d,]+)\s*rating/i);
        if (reviewMatch) {
          signals.reviewCount = parseInt(reviewMatch[1].replace(/,/g, ''));
        }
      }

      // Seller
      if (!signals.seller) {
        const sellerEl = document.querySelector("#sellerProfileTriggerId, #merchant-info");
        if (sellerEl) {
          signals.seller = sellerEl.innerText?.trim() || 'Amazon';
        } else {
          signals.seller = 'Amazon';
        }
      }

      // Badges
      if (document.querySelector("[data-feature-name='amazonChoice']")) {
        signals.badges.push("Amazon's Choice");
      }
      // Check for Best Seller badge
      const badges = Array.from(document.querySelectorAll(".a-badge-label"));
      if (badges.some(b => b.innerText.includes('Best Seller'))) {
        signals.badges.push("Best Seller");
      }
    } else if (location.hostname.includes("flipkart")) {
      // Rating
      const ratingEl = document.querySelector("._3LWZlK, .XQDdHH");
      if (ratingEl) {
        const ratingText = ratingEl.innerText || '';
        const ratingMatch = ratingText.match(/([\d.]+)/);
        if (ratingMatch) signals.rating = parseFloat(ratingMatch[1]);
      }

      // Review count
      const reviewEl = document.querySelector("._2_R_DZ span, ._13vcmD");
      if (reviewEl) {
        const reviewText = reviewEl.innerText || '';
        const reviewMatch = reviewText.match(/([\d,]+)\s*Rating/i);
        if (reviewMatch) {
          signals.reviewCount = parseInt(reviewMatch[1].replace(/,/g, ''));
        }
      }

      // Seller
      if (!signals.seller) {
        const sellerEl = document.querySelector("#sellerName, ._2Xfa2X");
        if (sellerEl) {
          signals.seller = sellerEl.innerText?.trim() || 'Flipkart';
        } else {
          signals.seller = 'Flipkart';
        }
      }

      // Badges
      const flipkartBadges = Array.from(document.querySelectorAll("._1i2dFb"));
      if (flipkartBadges.some(b => b.innerText.includes('Assured'))) {
        signals.badges.push("Flipkart Assured");
      }
    } else if (location.hostname.includes("myntra")) {
      // Rating
      const ratingEl = document.querySelector(".index-overallRating, .ratings-rating");
      if (ratingEl) {
        const ratingText = ratingEl.innerText || '';
        const ratingMatch = ratingText.match(/([\d.]+)/);
        if (ratingMatch) signals.rating = parseFloat(ratingMatch[1]);
      }

      // Review count
      const reviewEl = document.querySelector(".index-ratingsCount, .ratings-count");
      if (reviewEl) {
        const reviewText = reviewEl.innerText || '';
        const reviewMatch = reviewText.match(/([\d,]+)/);
        if (reviewMatch) {
          signals.reviewCount = parseInt(reviewMatch[1].replace(/,/g, ''));
        }
      }

      // Seller
      if (!signals.seller) {
        signals.seller = 'Myntra';
      }

      // Badges
      const myntraBadges = Array.from(document.querySelectorAll(".pdp-badge"));
      if (myntraBadges.some(b => b.innerText.includes('Bestseller'))) {
        signals.badges.push("Bestseller");
      }
    } else {
      // Generic extraction for other websites
      if (!signals.seller) {
        // Try to extract seller/brand from page
        const brandEl = document.querySelector('[itemprop="brand"], .brand, .product-brand, [class*="brand"]');
        if (brandEl) {
          signals.seller = brandEl.innerText?.trim() || brandEl.getAttribute('content');
        }
      }

      // Try to find ratings generically
      const bodyText = document.body.innerText || '';
      const ratingPatterns = [
        /([\d.]+)\s*out of\s*5/i,
        /([\d.]+)\s*\/\s*5/i,
        /rating[:\s]*([\d.]+)/i
      ];
      
      for (const pattern of ratingPatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          const rating = parseFloat(match[1]);
          if (rating >= 1 && rating <= 5) {
            signals.rating = rating;
            break;
          }
        }
      }

      // Try to find review count generically
      const reviewPatterns = [
        /([\d,]+)\s*reviews?/i,
        /([\d,]+)\s*ratings?/i,
        /([\d,]+)\s*customer reviews?/i
      ];
      
      for (const pattern of reviewPatterns) {
        const match = bodyText.match(pattern);
        if (match) {
          const count = parseInt(match[1].replace(/,/g, ''));
          if (count > 0 && count < 10000000) { // Sanity check
            signals.reviewCount = count;
            break;
          }
        }
      }
    }
  } catch (e) {
    console.warn("extractTrustSignals error", e);
  }

  console.log("🔍 Trust signals extracted:", signals);
  return signals;
}

// ---------------- MAIN SCRAPE ----------------
async function scrapeProduct() {
  try {
    // Auto-detect website currency
    const detectedCurrency = detectWebsiteCurrency();

    // Get user currency preference from storage (for manual override)
    const result = await chrome.storage.local.get(['picksyCurrency']);
    const userCurrency = result.picksyCurrency;

    // Use user preference if set, otherwise use detected currency
    const finalCurrency = userCurrency || detectedCurrency;

    const p = extractPrice();
    const avail = detectAvailability();
    const title = simpleTitle();
    const trustSignals = extractTrustSignals();

    // Generate cross-site comparison data
    const keywords = extractProductKeywords(title);
    const comparisonUrls = generateSearchUrls(keywords, location.hostname);

    const data = {
      source: location.hostname,
      url: canonicalUrl(),
      title: title,
      price: p.display, // Already formatted with detected currency
      priceValue: p.value,
      currency: detectedCurrency, // Show what was detected
      userCurrency: finalCurrency, // Show user preference
      availability: avail.status,
      availabilityReason: avail.reason,
      rating: trustSignals.rating,
      reviewCount: trustSignals.reviewCount,
      seller: trustSignals.seller,
      badges: trustSignals.badges,
      keywords: keywords, // For cross-site comparison
      comparisonUrls: comparisonUrls, // URLs to check other sites
      scrapedAt: new Date().toISOString()
    };

    console.log("🔍 Scraped Product Data:", data);
    return data;
  } catch (e) {
    console.error("scrapeProduct failed", e);
    return {
      source: location.hostname,
      url: canonicalUrl(),
      title: simpleTitle(),
      price: "",
      priceValue: null,
      currency: 'USD',
      userCurrency: 'USD',
      availability: "Unknown",
      availabilityReason: "error",
      rating: null,
      reviewCount: null,
      seller: null,
      badges: [],
      keywords: [],
      comparisonUrls: [],
      scrapedAt: new Date().toISOString()
    };
  }
}

// ---------------- MESSAGING ----------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("🔧 Content script received message:", msg);

  if (msg?.type === "PICKSY_SCRAPE") {
    console.log("🔧 Starting product scrape...");
    scrapeProduct().then((payload) => {
      console.log("🔧 Scrape completed, sending result:", payload);
      chrome.runtime.sendMessage({ type: "PICKSY_SCRAPE_RESULT", payload });
    }).catch((error) => {
      console.error("🔧 Scrape error:", error);
    });
    sendResponse({ received: true });
    return true;
  }

  if (msg?.type === "PICKSY_CURRENCY_CHANGED") {
    console.log("🔧 Currency changed, re-scraping...");
    scrapeProduct().then((payload) => {
      chrome.runtime.sendMessage({ type: "PICKSY_SCRAPE_RESULT", payload });
    }).catch((error) => {
      console.error("🔧 Re-scrape error:", error);
    });
    sendResponse({ received: true });
    return true;
  }

  sendResponse({ received: false });
});

// Add a simple test to verify content script is loaded
try {
  console.log("🔧 Picksy content script loaded on:", location.hostname);
  console.log("🔧 Content script ready to receive messages");
} catch (error) {
  console.error("🔧 Content script initialization error:", error);
}
