/**
 * Picksy Content Script - Modularized & Robust
 * Uses Strategy Pattern for multi-site support.
 */

class PriceStrategy {
  constructor() {
    this.name = 'BaseStrategy';
  }

  match(hostname) {
    return false;
  }

  getTitle() {
    return document.title;
  }

  getPrice() {
    return { display: "N/A", value: 0 };
  }

  getAvailability() {
    return { status: "Unknown", reason: "base strategy" };
  }

  getCurrency() {
    return "USD"; // Default
  }

  parsePrice(str) {
    if (!str) return 0;
    const cleaned = str.replace(/[^\d.]/g, ''); // Simple cleaning
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
  }
}

class AmazonStrategy extends PriceStrategy {
  match(hostname) {
    return hostname.includes('amazon');
  }

  getTitle() {
    return document.querySelector("#productTitle")?.innerText?.trim() || document.title;
  }

  getPrice() {
    const selectors = [
      "#corePrice_feature_div .a-price .a-offscreen",
      "#priceblock_dealprice",
      "#priceblock_ourprice",
      ".a-price .a-offscreen"
    ];

    for (let sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.innerText.trim();
        const value = this.parsePrice(text);
        if (value > 0) return { display: text, value: value };
      }
    }
    return super.getPrice();
  }

  getAvailability() {
    const avail = document.querySelector("#availability")?.innerText?.toLowerCase() || "";
    if (avail.includes("in stock")) return { status: "InStock", reason: "amazon text" };
    if (avail.includes("unavailable")) return { status: "OutOfStock", reason: "amazon text" };
    return { status: "InStock", reason: "assume stock" }; // Default for Amazon if no negative signal
  }
}

class FlipkartStrategy extends PriceStrategy {
  match(hostname) {
    return hostname.includes('flipkart');
  }

  getTitle() {
    return document.querySelector("span.VU-ZEz")?.innerText?.trim() || document.title;
  }

  getPrice() {
    const el = document.querySelector("div.Nx9bqj.CxhGGd") || document.querySelector("._30jeq3");
    if (el) {
      const text = el.innerText.trim();
      const value = this.parsePrice(text);
      return { display: text, value: value };
    }
    return super.getPrice();
  }
}

// ... Additional Strategies (Nike, Myntra) can be added here easily ...

class PicksyScraper {
  constructor() {
    this.strategies = [
      new AmazonStrategy(),
      new FlipkartStrategy()
    ];
    this.defaultStrategy = new PriceStrategy();
  }

  getStrategy() {
    const hostname = window.location.hostname;
    return this.strategies.find(s => s.match(hostname)) || this.defaultStrategy;
  }

  scrape() {
    const strategy = this.getStrategy();
    console.log(`Using strategy: ${strategy.constructor.name}`);

    try {
      const title = strategy.getTitle();
      const price = strategy.getPrice();
      const avail = strategy.getAvailability();

      return {
        title: title,
        price: price.display,
        priceValue: price.value,
        availability: avail.status,
        url: window.location.href,
        source: window.location.hostname
      };
    } catch (e) {
      console.error("Scrape failed", e);
      return null;
    }
  }
}

// Initialize
const scraper = new PicksyScraper();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "PICKSY_SCRAPE") {
    const data = scraper.scrape();
    sendResponse(data);

    // Also send message to background to trigger broadcast (crucial for popup listener)
    chrome.runtime.sendMessage({
      type: "PICKSY_SCRAPE_RESULT",
      payload: data
    });
  }
  return true;
});

console.log("🚀 Picksy Content Script Loaded (Modular)");
