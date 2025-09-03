// Ask the content script to scrape
document.getElementById("scanBtn").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { type: "PICKSY_SCRAPE" });
  });
});

// Listen for scrape results
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "PICKSY_SCRAPE_RESULT") {
    showResult(msg.payload);
  }
});

// Display current scrape result
function showResult(product) {
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = `
    <div class="product">
      <strong>${product.title}</strong><br/>
      💰 Price: ${product.price}<br/>
      📦 Status: ${product.availability}<br/>
      🔗 <a href="${product.url}" target="_blank">Open Link</a><br/>
      <button id="saveBtn">Save Item</button>
    </div>
  `;

  document.getElementById("saveBtn").addEventListener("click", () => {
    saveProduct(product);
  });
}

// Save to chrome storage
function saveProduct(product) {
  chrome.storage.local.get({ saved: [] }, (data) => {
    const updated = [...data.saved, product];
    chrome.storage.local.set({ saved: updated }, () => {
      loadSaved();
    });
  });
}

// ✅ Delete an item by index
function deleteProduct(index) {
  chrome.storage.local.get({ saved: [] }, (data) => {
    const updated = data.saved.filter((_, i) => i !== index);
    chrome.storage.local.set({ saved: updated }, () => {
      loadSaved();
    });
  });
}

// Load saved items when popup opens
function loadSaved() {
  chrome.storage.local.get({ saved: [] }, (data) => {
    const savedDiv = document.getElementById("savedItems");
    savedDiv.innerHTML = "";

    data.saved.forEach((p, i) => {
      const div = document.createElement("div");
      div.className = "product";
      div.innerHTML = `
        <strong>${p.title}</strong><br/>
        💰 ${p.price} | 📦 ${p.availability}<br/>
        <a href="${p.url}" target="_blank">Open</a><br/>
        <button class="deleteBtn" data-index="${i}">❌ Delete</button>
      `;
      savedDiv.appendChild(div);
    });

    // Attach delete button events
    document.querySelectorAll(".deleteBtn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const index = parseInt(e.target.dataset.index);
        deleteProduct(index);
      });
    });
  });
}

// Run immediately on popup open
loadSaved();
