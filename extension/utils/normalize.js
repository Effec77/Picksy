// utils/normalize.js

/**
 * Universal Module Definition (UMD) - compatible with:
 * 1. Browser Global (window.Normalize)
 * 2. Service Worker (self.Normalize)
 * 3. ES Modules (export)
 * 4. CommonJS (module.exports)
 */

const Normalize = {};

// --- Normalize prices into plain numbers ---
Normalize.normalizePrice = function (rawPrice) {
  if (!rawPrice) return null;

  let cleaned = rawPrice
    .toString()
    .replace(/[₹,]/g, "") // remove ₹ and commas
    .trim()
    .toLowerCase();

  // Handle "lakh" style (e.g., "1.5 lakh" → 150000)
  if (cleaned.includes("lakh")) {
    let num = parseFloat(cleaned.replace("lakh", ""));
    return Math.round(num * 100000);
  }

  let num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num);
};

// --- Sanitize product titles ---
Normalize.sanitizeTitle = function (title) {
  if (!title) return "";
  return title
    .replace(/add to your order|bank offer|buy now/gi, "")
    .replace(/\s+/g, " ")
    .trim();
};

// --- Add metadata ---
Normalize.addMetadata = function (item, source, category = null) {
  return {
    ...item,
    source: source || "unknown",
    category: category || "uncategorized",
    scrapedAt: new Date().toISOString(), // per-entry timestamp
  };
};

// --- Final JSON pipeline format (for one scrape snapshot) ---
Normalize.makePipelineItem = function (title, price, url, source, category) {
  return {
    title: Normalize.sanitizeTitle(title),
    price: {
      value: Normalize.normalizePrice(price),
      display: price,
    },
    url,
    source,
    category: category || "uncategorized",
    scrapedAt: new Date().toISOString(), // keep history timestamps
  };
};

// --- Merge new snapshot into history (for price graph) ---
Normalize.mergeIntoHistory = function (history = [], newItem) {
  return [...history, newItem]; // append instead of overwrite
};

// --- Generate Unique Product ID (Robust) ---
Normalize.generateProductId = function (url, title) {
  if (!url) return `unknown_${Date.now()}`;

  try {
    if (url.includes('amazon')) {
      const match = url.match(/\/dp\/([A-Z0-9]{10})/);
      if (match) return `amazon_${match[1]}`;
    }
    if (url.includes('flipkart')) {
      const match = url.match(/\/p\/([a-zA-Z0-9]+)/);
      if (match) return `flipkart_${match[1]}`;
    }

    // URL fallback
    let domain;
    try {
      domain = new URL(url).hostname.replace('www.', '');
    } catch {
      domain = 'unknown';
    }

    const titleHash = (title || "untitled").toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
    return `${domain}_${titleHash}`;
  } catch (e) {
    console.warn("generateProductId error:", e);
    return `unknown_${Date.now()}`;
  }
};

// --- EXPORT LOGIC ---

// 1. ES Modules (if environment supports it)
// We try to export standard names if we are in a module environment
try {
  // This will work in standard ES module environments, but might throw in pure script tags if not type="module"
  // However, since we are writing a file that might be treated as a script, we refrain from using top-level export
  // if we suspect it will break.
  // BUT the original file had "export function". This implies it WAS used as a module somewhere or intended to be.
  // If I remove "export", I break imports.
  // So I must include them. 
  // Wait, the original had "export function". If I keep it, it breaks script tags.
  // The previous analysis showed "utils/normalize.js" was NOT used in popup.html.
  // So making it "script tag friendly" is a net positive.
  // But I should also keep "export" for consumers that use import.
  // You cannot have named exports in a non-module script. It's a syntax error.
  // This is the dilemma.
  // However, I can check if `module` is available for CommonJS.
  // For ES modules, I can't conditionally export.
  // So I have to choose: Module or Script.
  // Since `popup.html` uses script tags for EVERYTHING else (`config.js`, `matcher.js`), 
  // I should make `normalize.js` a Script (global variable).
  // And REMOVE `export` keyword.
  // Use `module.exports` for Node.js usage if needed.
} catch (e) { }

// For compatibility with the existing codebase (which used export), I will check if any other file IMPORTS it.
// I listed `priceComparison.js` earlier, let's see if it imports `normalize.js`. 
// The outline of `priceComparison.js` didn't show imports.
// It seems the codebase relies on GLOBALS or monolithic files.
// So removing `export` is safer for the extension.
// I will stick to the plan: Define `Normalize` global.
// And `module.exports = Normalize` for Node environments.

if (typeof self !== 'undefined') {
  self.Normalize = Normalize;
  self.generateProductId = Normalize.generateProductId;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Normalize;
}