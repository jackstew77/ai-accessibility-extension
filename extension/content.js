document.addEventListener("mouseup", async () => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (!selectedText || selectedText.length < 20) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  showLoadingOverlay(rect);

  try {
    const response = await fetch(
      "https://ai-accessibility-extension.onrender.com/simplify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: selectedText })
      }
    );

    const data = await response.json();

    if (data.output) {
      showResultOverlay(rect, data.output, range);
    } else {
      showResultOverlay(rect, "Error: " + (data.error || "Unknown error"), range);
    }

  } catch (error) {
    showResultOverlay(rect, "Failed to connect to server.", range);
  }
});


function showLoadingOverlay(rect) {
  removeExistingOverlay();

  const overlay = document.createElement("div");
  overlay.id = "ai-overlay";

  styleOverlay(overlay, rect);
  overlay.innerText = "✨ Simplifying...";

  document.body.appendChild(overlay);
}


function showResultOverlay(rect, text, range) {
  removeExistingOverlay();

  const overlay = document.createElement("div");
  overlay.id = "ai-overlay";

  styleOverlay(overlay, rect);

  overlay.innerHTML = `
    <div style="margin-bottom:6px;">${text}</div>
    <button id="replace-btn" style="margin-right:6px;">Replace</button>
    <button id="close-btn">Close</button>
  `;

  overlay.style.opacity = "0";
  overlay.style.transition = "opacity 0.2s ease-in";
  document.body.appendChild(overlay);

  setTimeout(() => overlay.style.opacity = "1", 10);

  document.getElementById("close-btn").onclick = () => overlay.remove();

  document.getElementById("replace-btn").onclick = () => {
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    overlay.remove();
  };
}


function styleOverlay(overlay, rect) {
  overlay.style.position = "absolute";
  overlay.style.top = window.scrollY + rect.top + "px";
  overlay.style.left = window.scrollX + rect.left + "px";
  overlay.style.width = rect.width + "px";
  overlay.style.background = "white";
  overlay.style.padding = "10px";
  overlay.style.border = "2px solid #333";
  overlay.style.zIndex = 9999;
  overlay.style.boxShadow = "0px 6px 18px rgba(0,0,0,0.25)";
  overlay.style.fontSize = "14px";
  overlay.style.borderRadius = "8px";
}


function removeExistingOverlay() {
  const existing = document.getElementById("ai-overlay");
  if (existing) existing.remove();
}
