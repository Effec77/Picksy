// ----------------- ENHANCED PICKSY BACKGROUND SCRIPT -----------------

// ----------------- INSTALL DEFAULTS -----------------
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    picksySettings: {
      oosToggle: false,
      priceAlerts: true,
      autoScanEnabled: true
    },
    picksyCurrency: "INR",
  });

  // Create an alarm that runs every 6 hours for auto price checking
  chrome.alarms.create("picksyAutoCheck", { periodInMinutes: 360 });

  console.log("🚀 Picksy installed with auto-scan every 6 hours");
});

// ----------------- MESSAGE ROUTER -----------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("🔧 Background received message:", msg);

  // popup asks to scrape → forward to content script
  if (msg?.type === "PICKSY_SCRAPE_REQUEST") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      console.log("🔧 Active tab:", tab);
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: "PICKSY_SCRAPE" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("🔧 Error sending to content script:", chrome.runtime.lastError);
          } else {
            console.log("🔧 Message sent to content script successfully");
          }
        });
      }
    });
    sendResponse({ ok: true });
    return true;
  }

  // currency change
  if (msg?.type === "PICKSY_CURRENCY_CHANGE") {
    const currency = msg.currency || "INR";
    chrome.storage.local.set({ picksyCurrency: currency }, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { type: "PICKSY_CURRENCY_CHANGED" });
        }
      });
    });
    sendResponse({ ok: true });
    return true;
  }

  // scrape result comes back from content.js
  if (msg?.type === "PICKSY_SCRAPE_RESULT") {
    const payload = msg.payload || {};

    chrome.storage.local.set({ picksyLastScrape: payload });
    saveToHistory(payload);
    chrome.runtime.sendMessage({
      type: "PICKSY_SCRAPE_RESULT_BROADCAST",
      payload,
    });
  }
});

// ----------------- ALARM HANDLER -----------------
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "picksyAutoCheck") {
    console.log("⏰ Running scheduled auto-check...");

    chrome.storage.local.get(["saved", "picksySettings"], (res) => {
      const savedProducts = res.saved || [];
      const settings = res.picksySettings || {};

      if (!settings.autoScanEnabled) {
        console.log("⏰ Auto-scan disabled, skipping");
        return;
      }

      console.log(`⏰ Auto-checking ${savedProducts.length} saved products`);

      savedProducts.forEach((product, index) => {
        // Stagger requests to avoid overwhelming servers
        setTimeout(() => {
          scrapeProductInBackground(product.url, product.title);
        }, index * 2000); // 2 second delay between each request
      });
    });
  }
});

// ----------------- BACKGROUND SCRAPER -----------------
function scrapeProductInBackground(url, originalTitle) {
  console.log("📡 Auto-scraping:", url);

  fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  })
    .then((res) => res.text())
    .then((html) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      let title = originalTitle;
      let priceValue = null;
      let availability = "Unknown";

      // Amazon selectors
      if (url.includes("amazon")) {
        const titleEl = doc.querySelector("#productTitle");
        const priceEl = doc.querySelector("#corePrice_feature_div .a-price .a-offscreen, .a-price .a-offscreen, #priceblock_ourprice");
        const availEl = doc.querySelector("#availability");

        if (titleEl) title = titleEl.innerText.trim();
        if (priceEl) {
          const priceText = priceEl.innerText.replace(/[₹,\s]/g, "");
          priceValue = parseFloat(priceText) || null;
        }
        if (availEl) {
          const availText = availEl.innerText.toLowerCase();
          availability = availText.includes("in stock") ? "InStock" : "OutOfStock";
        }
      }

      // Flipkart selectors
      else if (url.includes("flipkart")) {
        const titleEl = doc.querySelector(".B_NuCI, ._35KyD6");
        const priceEl = doc.querySelector("._30jeq3, ._16Jk6d, .Nx9bqj.CxhGGd");

        if (titleEl) title = titleEl.innerText.trim();
        if (priceEl) {
          const priceText = priceEl.innerText.replace(/[₹,\s]/g, "");
          priceValue = parseFloat(priceText) || null;
        }
        availability = "InStock"; // Assume in stock if page loads
      }

      const payload = {
        title: title,
        priceValue: priceValue,
        url: url,
        currency: "INR",
        availability: availability,
        source: new URL(url).hostname,
        scrapedAt: new Date().toISOString()
      };

      console.log("📡 Auto-scraped payload:", payload);

      // Send into same pipeline with auto flag
      saveToHistory(payload, true);
    })
    .catch((err) => {
      console.error("📡 Auto scrape failed for", url, ":", err);
    });
}

// ----------------- ENHANCED HISTORY HANDLING -----------------
function generateProductId(url, title) {
  if (url.includes("amazon")) {
    const match = url.match(/\/dp\/([A-Z0-9]{10})/);
    if (match) return `amazon_${match[1]}`;
  }
  if (url.includes("flipkart")) {
    const match = url.match(/\/p\/([a-zA-Z0-9]+)/);
    if (match) return `flipkart_${match[1]}`;
  }

  const domain = new URL(url).hostname.replace("www.", "");
  const titleHash = title.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 20);
  return `${domain}_${titleHash}`;
}

function saveToHistory(payload, fromAuto = false) {
  const productId = generateProductId(payload.url, payload.title);
  const timestamp = Date.now();

  const historyEntry = {
    price: payload.priceValue,
    stock: payload.availability === "InStock",
    timestamp: timestamp,
    currency: payload.currency,
  };

  chrome.storage.local.get([`history_${productId}`, "picksySettings"], (result) => {
    const existingProduct = result[`history_${productId}`] || {
      productId: productId,
      title: payload.title,
      url: payload.url,
      source: payload.source,
      history: [],
    };

    const lastEntry = existingProduct.history[existingProduct.history.length - 1];
    const settings = result.picksySettings || {};

    // Only add if price/stock actually changed
    if (
      !lastEntry ||
      lastEntry.price !== historyEntry.price ||
      lastEntry.stock !== historyEntry.stock
    ) {
      existingProduct.history.push(historyEntry);

      // Keep only last 50 entries
      if (existingProduct.history.length > 50) {
        existingProduct.history = existingProduct.history.slice(-50);
      }

      chrome.storage.local.set({ [`history_${productId}`]: existingProduct });

      // Price drop notification (only for auto scans)
      if (
        fromAuto &&
        settings.priceAlerts &&
        lastEntry &&
        historyEntry.price !== null &&
        lastEntry.price !== null &&
        historyEntry.price < lastEntry.price
      ) {
        const priceDrop = lastEntry.price - historyEntry.price;
        const percentDrop = ((priceDrop / lastEntry.price) * 100).toFixed(1);

        chrome.notifications.create({
          type: "basic",
          iconUrl: "assets/logo.png",
          title: "🎉 Picksy Price Drop Alert!",
          message: `${payload.title.substring(0, 50)}... dropped by ₹${priceDrop.toLocaleString()} (${percentDrop}%)`,
          buttons: [
            { title: "View Product" },
            { title: "Dismiss" }
          ]
        });

        console.log(`💰 Price drop detected: ${payload.title} - ₹${lastEntry.price} → ₹${historyEntry.price}`);
      }
    } else {
      console.log("📊 No price/stock change detected, skipping history update");
    }
  });
}

// Handle notification clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) { // "View Product" button
    // Could open the product URL, but we'd need to store it with the notification
    chrome.notifications.clear(notificationId);
  } else if (buttonIndex === 1) { // "Dismiss" button
    chrome.notifications.clear(notificationId);
  }
});