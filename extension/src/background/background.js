// minimal service worker scaffold for Picksy
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ 
      picksySettings: { oosToggle: false },
      picksyCurrency: 'INR'
    });
  });
  
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // basic router: if popup asks to scrape, forward message to content script
    if (msg?.type === "PICKSY_SCRAPE_REQUEST") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { type: "PICKSY_SCRAPE" });
        }
      });
      sendResponse({ ok: true });
      return true;
    }

    // handle currency change
    if (msg?.type === "PICKSY_CURRENCY_CHANGE") {
      const currency = msg.currency || 'INR';
      chrome.storage.local.set({ picksyCurrency: currency }, () => {
        // notify content script to re-scrape with new currency
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
  
    // content script posts back the scrape result
    if (msg?.type === "PICKSY_SCRAPE_RESULT") {
      const payload = msg.payload || {};
      chrome.storage.local.set({ picksyLastScrape: payload }, () => {
        chrome.runtime.sendMessage({ type: "PICKSY_SCRAPE_RESULT_BROADCAST", payload });
      });
    }
  });
  