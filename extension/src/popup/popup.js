const scanBtn = document.getElementById("scanBtn");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");

function render(payload) {
  if (!payload) return;
  resultEl.style.display = "block";
  resultEl.innerHTML = `
    <div><span class="label">Title:</span> ${payload.title || "-"}</div>
    <div><span class="label">Price:</span> ${payload.price ? "₹" + payload.price : "-"}</div>
    <div><span class="label">Availability:</span> ${payload.availability || "-"}</div>
    <div class="muted">${payload.url || ""}</div>
  `;
}

scanBtn.addEventListener("click", () => {
  statusEl.textContent = "Scanning…";
  chrome.runtime.sendMessage({ type: "PICKSY_SCRAPE_REQUEST" }, (res) => {
    if (!res?.ok) statusEl.textContent = "Could not start scan.";
  });
});

// listen for background broadcast
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "PICKSY_SCRAPE_RESULT_BROADCAST") {
    statusEl.textContent = "Done";
    render(msg.payload);
  }
});

// show cached last scrape if present
chrome.storage.local.get(["picksyLastScrape"], ({ picksyLastScrape }) => {
  if (picksyLastScrape) render(picksyLastScrape);
});
