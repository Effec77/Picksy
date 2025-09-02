// Minimal content script: responds to PICKSY_SCRAPE and returns a tiny product object.
// Improved title + price scraping, but keeps stable messaging so no connection errors.

function simpleTitle() {
    // Site-specific selectors first
    let title = "";
  
    if (location.hostname.includes("amazon")) {
      title = document.querySelector("#productTitle")?.innerText?.trim() || "";
    } else if (location.hostname.includes("flipkart")) {
      title = document.querySelector("span.VU-ZEz")?.innerText?.trim() ||
              document.querySelector("._35KyD6")?.innerText?.trim() || "";
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
  
  function simplePrice() {
    let price = "";
  
    // Site-specific selectors
    if (location.hostname.includes("amazon")) {
      price =
        document.querySelector(".a-price .a-offscreen")?.innerText?.trim() ||
        document.querySelector("#priceblock_ourprice")?.innerText?.trim() ||
        document.querySelector("#priceblock_dealprice")?.innerText?.trim() || "";
    } else if (location.hostname.includes("flipkart")) {
      price =
        document.querySelector("div.Nx9bqj.CxhGGd")?.innerText?.trim() ||
        document.querySelector("._30jeq3")?.innerText?.trim() || "";
    } else if (location.hostname.includes("myntra")) {
      price =
        document.querySelector(".pdp-price")?.innerText?.trim() ||
        document.querySelector(".pdp-discount-price")?.innerText?.trim() || "";
    }
  
    // Generic regex fallback
    if (!price) {
      const text = document.body.innerText;
      const rx = /(₹\s?[\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?\s?INR)/i;
      const m = text.match(rx);
      price = m ? m[0] : "";
    }
  
    return price.replace(/[^\d₹.,]/g, "").trim();
  }
  
  function canonicalUrl() {
    const link = document.querySelector('link[rel="canonical"]');
    return link?.href || location.href;
  }
  
  async function scrapeProduct() {
    const data = {
      source: location.hostname,
      url: canonicalUrl(),
      title: simpleTitle(),
      price: simplePrice(),
      availability: document.body.innerText.toLowerCase().includes("out of stock")
        ? "OutOfStock"
        : "InStock",
      scrapedAt: new Date().toISOString(),
    };
  
    // ✅ Log automatically so you don’t have to open console manually
    console.log("🔍 Scraped Product Data:", data);
  
    return data;
  }
  
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === "PICKSY_SCRAPE") {
      scrapeProduct().then((payload) => {
        chrome.runtime.sendMessage({ type: "PICKSY_SCRAPE_RESULT", payload });
      });
    }
  });
  