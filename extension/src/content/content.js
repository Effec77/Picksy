// content.js
// Responds to PICKSY_SCRAPE and returns a product object.
// Improved: robust price extraction (site-aware + scoring), keeps connection flow intact.

function simpleTitle() {
  // Site-specific selectors first
  let title = "";

  if (location.hostname.includes("amazon")) {
    title = document.querySelector("#productTitle")?.innerText?.trim() || "";
  } else if (location.hostname.includes("flipkart")) {
    title =
      document.querySelector("span.VU-ZEz")?.innerText?.trim() ||
      document.querySelector("._35KyD6")?.innerText?.trim() ||
      "";
  } else if (location.hostname.includes("myntra")) {
    title = document.querySelector(".pdp-title")?.innerText?.trim() || "";
  }

  // Generic fallbacks
  const og = document.querySelector('meta[property="og:title"]')?.content;
  const tw = document.querySelector('meta[name="twitter:title"]')?.content;
  const h1 = document.querySelector("h1")?.innerText?.trim();
  const titleTag = document.title;

  return title || og?.trim() || tw?.trim() || h1 || titleTag || "";
}

// ---------- PRICE HELPERS ----------

function parsePriceToNumber(str) {
  if (!str) return null;
  let s = String(str).toLowerCase();

  // Handle lakh / lac / crore
  const lakhMatch = s.match(/([\d.]+)\s*(lakh|lac)/);
  if (lakhMatch) {
    const v = parseFloat(lakhMatch[1]);
    return isNaN(v) ? null : Math.round(v * 100000);
  }
  const croreMatch = s.match(/([\d.]+)\s*crore/);
  if (croreMatch) {
    const v = parseFloat(croreMatch[1]);
    return isNaN(v) ? null : Math.round(v * 10000000);
  }

  // Generic ₹/INR numbers
  const num = parseFloat(s.replace(/[^0-9.]/g, ""));
  return isNaN(num) ? null : Math.round(num);
}

function formatINR(num) {
  if (num == null) return "";
  try {
    return "₹" + Number(num).toLocaleString("en-IN");
  } catch {
    return "₹" + num;
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
  // Higher is better
  let score = 0;
  const lc = ((el.id || "") + " " + (el.className || "")).toLowerCase();

  // Prefer known "real price" keywords
  if (/(priceblock|dealprice|ourprice|pricetopay|a-offscreen|selling|final|pay)/.test(lc)) score += 4;

  // Penalize MRPs / strike-throughs
  if (/(mrp|strike|strikethrough|was-price)/.test(lc)) score -= 3;
  if (isStruckThrough(el)) score -= 4;

  // Prefer larger values (but not absurd)
  if (value >= 1000) score += 2;
  if (value >= 10000) score += 1;

  // Deprioritize suspiciously tiny add-ons
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
    // Generic pricey places
    '[class*="price"]',
    '[id*="price"]'
  ];

  const set = new Set();
  const nodes = [];
  selectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      if (!set.has(el)) {
        set.add(el);
        nodes.push(el);
      }
    });
  });
  return nodes;
}

function extractPrice() {
  // 1) Site-specific fast paths
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
      const t = document.querySelector(sel)?.innerText?.trim();
      const v = parsePriceToNumber(t);
      if (v) return { display: formatINR(v), value: v };
    }
  } else if (location.hostname.includes("flipkart")) {
    const order = ["div.Nx9bqj.CxhGGd", "._30jeq3", "._16Jk6d"];
    for (const sel of order) {
      const t = document.querySelector(sel)?.innerText?.trim();
      const v = parsePriceToNumber(t);
      if (v) return { display: formatINR(v), value: v };
    }
  } else if (location.hostname.includes("myntra")) {
    const order = [".pdp-discount-price", ".pdp-price"];
    for (const sel of order) {
      const t = document.querySelector(sel)?.innerText?.trim();
      const v = parsePriceToNumber(t);
      if (v) return { display: formatINR(v), value: v };
    }
  }

  // 2) Scored candidate search across price-like elements
  const candidates = [];
  collectCandidateNodes().forEach((el) => {
    const txt = el.innerText?.trim();
    if (!txt) return;
    // Extract the first ₹-style amount in the element
    const m = txt.match(/(₹\s?[\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?\s?inr)/i);
    if (m) {
      const v = parsePriceToNumber(m[0]);
      if (v) {
        candidates.push({
          el,
          value: v,
          score: scorePriceElement(el, v)
        });
      }
    }
  });

  if (candidates.length) {
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.value - a.value; // tie-breaker by larger price
    });
    const chosen = candidates[0];
    return { display: formatINR(chosen.value), value: chosen.value };
  }

  // 3) Final fallback: scan whole body for all ₹ amounts and pick the largest
  const text = document.body.innerText || "";
  const all = text.match(/₹\s?[\d,]+(?:\.\d{1,2})?/g);
  if (all && all.length) {
    const nums = all.map((s) => parsePriceToNumber(s)).filter(Boolean);
    if (nums.length) {
      const best = Math.max(...nums);
      return { display: formatINR(best), value: best };
    }
  }

  return { display: "", value: null };
}

// ---------- URL ----------

function canonicalUrl() {
  const link = document.querySelector('link[rel="canonical"]');
  return link?.href || location.href;
}

// ---------- MAIN SCRAPE ----------

async function scrapeProduct() {
  const p = extractPrice();

  const data = {
    source: location.hostname,
    url: canonicalUrl(),
    title: simpleTitle(),
    price: p.display,       // human-friendly (₹ with Indian commas)
    priceValue: p.value,    // numeric for comparisons/graphs
    availability: document.body.innerText.toLowerCase().includes("out of stock")
      ? "OutOfStock"
      : "InStock",
    scrapedAt: new Date().toISOString()
  };

  console.log("🔍 Scraped Product Data:", data);
  return data;
}

// ---------- MESSAGING (unchanged) ----------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "PICKSY_SCRAPE") {
    scrapeProduct().then((payload) => {
      chrome.runtime.sendMessage({ type: "PICKSY_SCRAPE_RESULT", payload });
    });
  }
});
