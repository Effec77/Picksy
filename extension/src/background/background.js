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
        // Try to send message to content script
        chrome.tabs.sendMessage(tab.id, { type: "PICKSY_SCRAPE" }, (response) => {
          // Suppress the "receiving end does not exist" error - it's harmless
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            // Only log if it's not the common "receiving end" error
            if (!lastError.message.includes("Receiving end does not exist")) {
              console.error("🔧 Error details:", lastError.message);
            }
            
            // Silently inject content script if needed
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['src/content/content.js']
            }).then(() => {
              // Retry sending message after injection
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, { type: "PICKSY_SCRAPE" }, (retryResponse) => {
                  // Suppress error on retry too
                  if (chrome.runtime.lastError) {
                    // Silently ignore - content script will be ready on next scan
                  }
                });
              }, 1000);
            }).catch(() => {
              // Silently ignore injection errors - content script may already be loaded
            });
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

  // Manual background scan trigger (for testing)
  if (msg?.type === "PICKSY_MANUAL_BACKGROUND_SCAN") {
    chrome.storage.local.get(["saved"], (res) => {
      const savedProducts = res.saved || [];
      if (savedProducts.length > 0) {
        console.log("🧪 Manual background scan triggered");
        scrapeProductsInSequence(savedProducts);
        sendResponse({ ok: true, count: savedProducts.length });
      } else {
        sendResponse({ ok: false, error: "No saved products" });
      }
    });
    return true;
  }

  // Test notification trigger (for testing)
  if (msg?.type === "PICKSY_TEST_NOTIFICATION") {
    console.log("🧪 Test notification triggered");
    saveToHistory(msg.payload, true);
    sendResponse({ ok: true });
    return true;
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

      if (savedProducts.length === 0) {
        console.log("⏰ No saved products to check");
        return;
      }

      console.log(`⏰ Auto-checking ${savedProducts.length} saved products`);

      // Use new tab-based scraper
      scrapeProductsInSequence(savedProducts);
    });
  }
});

// ----------------- TAB-BASED BACKGROUND SCRAPER -----------------
function scrapeProductsInSequence(products) {
  if (!products || products.length === 0) {
    console.log("⏰ No products to scrape");
    return;
  }

  // Record scan start time
  chrome.storage.local.set({ lastBackgroundScan: Date.now() });

  let currentIndex = 0;
  const scrapedProducts = [];

  function scrapeNext() {
    if (currentIndex >= products.length) {
      console.log(`✅ Background scraping complete. Updated ${scrapedProducts.length} products`);
      // Update last scan time again on completion
      chrome.storage.local.set({ lastBackgroundScan: Date.now() });
      return;
    }

    const product = products[currentIndex];
    console.log(`📡 [${currentIndex + 1}/${products.length}] Scraping: ${product.title.substring(0, 50)}...`);

    // Create invisible tab
    chrome.tabs.create({
      url: product.url,
      active: false
    }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error(`❌ Failed to create tab: ${chrome.runtime.lastError.message}`);
        currentIndex++;
        setTimeout(scrapeNext, 2000);
        return;
      }

      const tabId = tab.id;
      let scraped = false;

      // Wait for page to load and content script to inject
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, { type: "PICKSY_SCRAPE" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error(`❌ Content script error: ${chrome.runtime.lastError.message}`);
          } else {
            scraped = true;
            scrapedProducts.push(product.title);
          }

          // Close tab
          chrome.tabs.remove(tabId, () => {
            console.log(`🗑️ Closed tab for: ${product.title.substring(0, 30)}...`);
          });

          // Move to next product
          currentIndex++;
          setTimeout(scrapeNext, 3000); // 3 second delay between products
        });
      }, 6000); // Wait 6 seconds for page load

      // Failsafe: close tab if scraping hangs
      setTimeout(() => {
        if (!scraped) {
          console.warn(`⚠️ Scraping timeout for: ${product.title.substring(0, 30)}...`);
          chrome.tabs.remove(tabId);
          currentIndex++;
          setTimeout(scrapeNext, 2000);
        }
      }, 15000); // 15 second timeout
    });
  }

  scrapeNext();
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
  if (!payload || !payload.url || !payload.title) {
    console.warn("⚠️ Invalid payload, skipping history save");
    return;
  }

  const productId = generateProductId(payload.url, payload.title);
  const timestamp = Date.now();

  const historyEntry = {
    price: payload.priceValue,
    stock: payload.availability === "InStock",
    timestamp: timestamp,
    currency: payload.currency || "INR",
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

    // Only add if price/stock actually changed OR this is first entry
    const hasChanged = !lastEntry ||
      lastEntry.price !== historyEntry.price ||
      lastEntry.stock !== historyEntry.stock;

    if (hasChanged) {
      existingProduct.history.push(historyEntry);

      // Keep only last 50 entries
      if (existingProduct.history.length > 50) {
        existingProduct.history = existingProduct.history.slice(-50);
      }

      chrome.storage.local.set({ [`history_${productId}`]: existingProduct }, () => {
        console.log(`💾 History updated for: ${payload.title.substring(0, 30)}... (${existingProduct.history.length} entries)`);
      });

      // Price drop notification (only for background auto-scans)
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
          iconUrl: chrome.runtime.getURL("assets/logo.png"),
          title: "🎉 Picksy Price Drop Alert!",
          message: `${payload.title.substring(0, 50)}... dropped by ₹${priceDrop.toLocaleString()} (${percentDrop}%)`,
          buttons: [
            { title: "View Product" },
            { title: "Dismiss" }
          ],
          requireInteraction: true
        }, (notificationId) => {
          if (chrome.runtime.lastError) {
            console.error("Notification error:", chrome.runtime.lastError.message);
          } else {
            console.log("✅ Notification created:", notificationId);
            // Store product URL with notification for click handling
            chrome.storage.local.set({ [`notification_${notificationId}`]: payload.url });
          }
        });

        console.log(`💰 Price drop detected: ${payload.title.substring(0, 30)}... - ₹${lastEntry.price} → ₹${historyEntry.price}`);
      }

      // Stock back notification
      if (
        fromAuto &&
        settings.priceAlerts &&
        lastEntry &&
        !lastEntry.stock &&
        historyEntry.stock
      ) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: chrome.runtime.getURL("assets/logo.png"),
          title: "📦 Product Back in Stock!",
          message: `${payload.title.substring(0, 60)}... is now available`,
          buttons: [
            { title: "View Product" },
            { title: "Dismiss" }
          ],
          requireInteraction: true
        }, (notificationId) => {
          if (chrome.runtime.lastError) {
            console.error("Notification error:", chrome.runtime.lastError.message);
          } else {
            console.log("✅ Notification created:", notificationId);
            chrome.storage.local.set({ [`notification_${notificationId}`]: payload.url });
          }
        });

        console.log(`📦 Stock restored: ${payload.title.substring(0, 30)}...`);
      }
    } else {
      console.log(`📊 No change for: ${payload.title.substring(0, 30)}...`);
    }
  });
}

// ----------------- NOTIFICATION HANDLERS -----------------
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    // "View Product" button clicked
    chrome.storage.local.get([`notification_${notificationId}`], (result) => {
      const productUrl = result[`notification_${notificationId}`];
      if (productUrl) {
        chrome.tabs.create({ url: productUrl });
        // Clean up stored URL
        chrome.storage.local.remove([`notification_${notificationId}`]);
      }
    });
  }

  // Clear notification for both buttons
  chrome.notifications.clear(notificationId);
});

// Handle notification click (clicking notification body)
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.storage.local.get([`notification_${notificationId}`], (result) => {
    const productUrl = result[`notification_${notificationId}`];
    if (productUrl) {
      chrome.tabs.create({ url: productUrl });
      chrome.storage.local.remove([`notification_${notificationId}`]);
    }
  });
  chrome.notifications.clear(notificationId);
});

// ------------- TEST NOTIFICATION FUNCTION (for background console) -------------
// Open background service worker console and run: testNotificationFromBackground()
globalThis.testNotificationFromBackground = function() {
  console.log("🧪 Testing notification from background...");
  
  chrome.storage.local.get(null, (items) => {
    const historyKeys = Object.keys(items).filter(k => k.startsWith('history_'));
    
    if (historyKeys.length === 0) {
      console.error("❌ No products with history found. Save a product first!");
      return;
    }
    
    const firstProduct = items[historyKeys[0]];
    console.log("Testing with:", firstProduct.title);
    
    // Get the last price
    const lastPrice = firstProduct.history[firstProduct.history.length - 1].price;
    console.log("Last price:", lastPrice);
    
    // Create a lower price to trigger notification
    const lowerPrice = Math.round(lastPrice * 0.9); // 10% discount
    console.log("New lower price:", lowerPrice);
    
    // Trigger notification
    saveToHistory({
      title: firstProduct.title,
      priceValue: lowerPrice,
      url: firstProduct.url,
      currency: "INR",
      availability: "InStock",
      source: firstProduct.source
    }, true);
    
    console.log("✅ Notification should appear now!");
  });
};
