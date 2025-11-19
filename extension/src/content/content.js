// content.js
// Safe content script: responds to PICKSY_SCRAPE and returns a product object.
// Keeps messaging exactly like before to avoid connection issues.

// ---------------- TITLE ----------------
function simpleTitle() {
  try {
    let title = "";
    if (location.hostname.includes("amazon")) {
      title = document.querySelector("#productTitle")?.innerText?.trim() || "";
    } else if (location.hostname.includes("flipkart")) {
      title =
        document.querySelector("span.VU-ZEz")?.innerText?.trim() ||
        document.querySelector("._35KyD6")?.innerText?.trim() ||
        "";
    } else if (location.hostname.includes("myntra")) {
      // Myntra has brand and product name in separate elements
      // Try multiple selectors to find brand and product
      const brandSelectors = [".pdp-title", ".pdp-brand", "h1.pdp-name", ".brand-name", "[data-testid='brand']", ".product-brand"];
      const productSelectors = [".pdp-name", ".product-name", ".pdp-product-name", "h1.product-title", ".product-title", "[data-testid='name']", ".product-productName"];

      let brand = "";
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

      console.log("🔍 Myntra title extraction:", { brand, product, combined: title, selectors: { brandSelectors, productSelectors } });
    }

    const og = document.querySelector('meta[property="og:title"]')?.content;
    const tw = document.querySelector('meta[name="twitter:title"]')?.content;
    const h1 = document.querySelector("h1")?.innerText?.trim();
    const titleTag = document.title;

    return title || og?.trim() || tw?.trim() || h1 || titleTag || "";
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
  const s = String(str).toLowerCase();

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

  // plain numeric - properly handle commas and currency symbols
  // First, extract the first valid price pattern
  const pricePattern = /[₹$€£]?\s*[\d,]+(?:\.\d{1,2})?/;
  const match = s.match(pricePattern);

  if (match) {
    let cleaned = match[0].replace(/[₹$€£,\s]/g, ""); // Remove currency symbols, commas, spaces
    cleaned = cleaned.replace(/[^0-9.]/g, ""); // Remove any remaining non-numeric chars except dots
    const num = parseFloat(cleaned);
    console.log("💰 Cleaned price:", s, "→", match[0], "→", cleaned, "→", num);
    return isNaN(num) ? null : Math.round(num);
  }

  // Fallback: clean the whole string
  let cleaned = s.replace(/[₹$€£,\s]/g, "");
  cleaned = cleaned.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  console.log("💰 Fallback cleaned price:", s, "→", cleaned, "→", num);
  return isNaN(num) ? null : Math.round(num);
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

  if (/(priceblock|dealprice|ourprice|pricetopay|a-offscreen|selling|final|pay|discount-price)/.test(lc)) score += 4;
  if (/(mrp|strike|strikethrough|was-price|scratch)/.test(lc)) score -= 3;
  if (isStruckThrough(el)) score -= 4;
  if (value >= 1000) score += 1;
  if (value >= 10000) score += 1;
  if (value <= 800) score -= 3;

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
    }

    // scored candidate search
    const candidates = [];
    const freq = new Map();

    collectCandidateNodes().forEach((el) => {
      try {
        const txt = el.innerText?.trim();
        if (!txt) return;

        // Multi-currency price pattern matching
        const patterns = [
          /(₹\s?[\d,]+(?:\.\d{1,2})?)/i,  // INR
          /(\$\s?[\d,]+(?:\.\d{1,2})?)/i,  // USD
          /(€\s?[\d,]+(?:\.\d{1,2})?)/i,   // EUR
          /(£\s?[\d,]+(?:\.\d{1,2})?)/i,   // GBP
          /(C\$\s?[\d,]+(?:\.\d{1,2})?)/i, // CAD
          /([\d,]+(?:\.\d{1,2})?\s?(inr|usd|eur|gbp|cad))/i // Text format
        ];

        let match = null;
        for (const pattern of patterns) {
          match = txt.match(pattern);
          if (match) break;
        }

        if (!match) return;
        const v = parsePriceToNumber(match[0], detectedCurrency);
        if (!v) return;

        freq.set(v, (freq.get(v) || 0) + 1);
        candidates.push({
          el,
          value: v,
          baseScore: scorePriceElement(el, v)
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
      candidates.sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return b.value - a.value;
      });
      const chosen = candidates[0];
      return { display: formatPrice(chosen.value, detectedCurrency), value: chosen.value, via: "scored-candidates" };
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
    'the souled store', 'campus sutra', 'being human', 'flying machine', 'pepe jeans', 'spykar'
  ];

  // Step 3: Extract product categories and types
  const productTypes = [
    // Electronics
    'iphone', 'galaxy', 'oneplus', 'pixel', 'macbook', 'thinkpad', 'inspiron', 'xps', 'pavilion', 'ideapad', 'vivobook', 'zenbook',
    'graphics card', 'gpu', 'processor', 'cpu', 'motherboard', 'ram', 'memory', 'ssd', 'hard drive', 'monitor', 'keyboard', 'mouse',
    'rtx', 'gtx', 'radeon', 'ryzen', 'core i3', 'core i5', 'core i7', 'core i9',
    // Fashion
    'shirt', 'tshirt', 't-shirt', 'jeans', 'dress', 'shoes', 'sneakers', 'jacket', 'hoodie', 'sweatshirt', 'kurta', 'saree', 'kurti'
  ];

  // Step 4: Extract specifications and key features
  const lowerTitle = processedTitle.toLowerCase();
  const keywords = [];

  // Extract brand
  let foundBrand = '';
  for (const brand of allBrands) {
    if (lowerTitle.includes(brand.toLowerCase())) {
      foundBrand = brand;
      keywords.push(brand);
      break;
    }
  }

  // Extract product type/model
  let foundType = '';
  for (const type of productTypes) {
    if (lowerTitle.includes(type.toLowerCase())) {
      foundType = type;
      if (!keywords.includes(type)) {
        keywords.push(type);
      }
      break;
    }
  }

  // Extract model numbers and specifications
  const specs = [];

  // Model numbers (iPhone 15, Galaxy S24, RTX 4090, etc.)
  const modelMatch = lowerTitle.match(/(\w+\s*\d+\s*\w*)/g);
  if (modelMatch) {
    modelMatch.forEach(model => {
      const cleanModel = model.trim();
      if (cleanModel.length > 2 && !keywords.includes(cleanModel)) {
        specs.push(cleanModel);
      }
    });
  }

  // Storage capacity
  const storageMatch = lowerTitle.match(/(\d+)\s*(gb|tb)(?!\s*(ram|memory|ddr))/gi);
  if (storageMatch) {
    storageMatch.forEach(storage => {
      const cleanStorage = storage.replace(/\s+/g, '').toUpperCase();
      if (!specs.includes(cleanStorage)) {
        specs.push(cleanStorage);
      }
    });
  }

  // RAM
  const ramMatch = lowerTitle.match(/(\d+)\s*gb\s*(ram|memory|ddr)/gi);
  if (ramMatch) {
    ramMatch.forEach(ram => {
      const cleanRam = ram.replace(/\s+/g, ' ').trim();
      if (!specs.includes(cleanRam)) {
        specs.push(cleanRam);
      }
    });
  }

  // Add specifications to keywords
  keywords.push(...specs.slice(0, 3));

  // Step 5: Add important descriptive words
  const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'under', 'over', 'men', 'women', 'boys', 'girls', 'kids', 'unisex', 'home', 'office', 'gaming', 'mobile', 'phone', 'smartphone', 'laptop', 'computer', 'pc'];

  const additionalWords = processedTitle
    .toLowerCase()
    .split(/\s+/)
    .filter(word => {
      return word.length > 3 &&
        !stopWords.includes(word) &&
        !keywords.some(k => k.toLowerCase().includes(word)) &&
        !word.match(/^\d+$/) && // Skip pure numbers
        word.match(/^[a-z]+$/); // Only alphabetic words
    })
    .slice(0, 2);

  keywords.push(...additionalWords);

  // Step 6: Clean and limit final keywords
  const finalKeywords = keywords
    .filter(k => k && k.length > 1)
    .slice(0, 5);

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

  // Create a more targeted search query
  // Use the first keyword (usually the product name) as primary, others as refinements
  const primaryKeyword = keywords[0];
  const searchQuery = keywords.join(' ');

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
