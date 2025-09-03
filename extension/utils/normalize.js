// utils/normalize.js

// --- Normalize prices into plain numbers ---
export function normalizePrice(rawPrice) {
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
  }
  
  // --- Sanitize product titles ---
  export function sanitizeTitle(title) {
    if (!title) return "";
    return title
      .replace(/add to your order|bank offer|buy now/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  
  // --- Add metadata ---
  export function addMetadata(item, source, category = null) {
    return {
      ...item,
      source: source || "unknown",
      category: category || "uncategorized",
      scrapedAt: new Date().toISOString(), // per-entry timestamp
    };
  }
  
  // --- Final JSON pipeline format (for one scrape snapshot) ---
  export function makePipelineItem(title, price, url, source, category) {
    return {
      title: sanitizeTitle(title),
      price: {
        value: normalizePrice(price),
        display: price,
      },
      url,
      source,
      category: category || "uncategorized",
      scrapedAt: new Date().toISOString(), // keep history timestamps
    };
  }
  
  // --- Merge new snapshot into history (for price graph) ---
  export function mergeIntoHistory(history = [], newItem) {
    return [...history, newItem]; // append instead of overwrite
  }
  