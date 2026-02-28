document.addEventListener("mouseup", async () => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  // Only run if selection is meaningful length
  if (!selectedText || selectedText.length < 20) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

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
      createOverlay(rect, data.output);
    } else if (data.error) {
      createOverlay(rect, "Backend Error: " + data.error);
    } else {
      createOverlay(rect, "Unexpected response from server.");
    }

  } catch (error) {
    createOverlay(rect, "Failed to connect to server.");
  }
});


function createOverlay(rect, newText) {
  // Remove existing overlay if one exists
  const existing = document.getElementById("ai-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "ai-overlay";

  overlay.style.position = "absolute";
  overlay.style.top = window.scrollY + rect.top + "px";
  overlay.style.left = window.scrollX + rect.left + "px";
  overlay.style.width = rect.width + "px";
  overlay.style.background = "#fff8dc";
  overlay.style.padding = "8px";
  overlay.style.border = "2px solid black";
  overlay.style.zIndex = 9999;
  overlay.style.boxShadow = "0px 4px 12px rgba(0,0,0,0.2)";
  overlay.style.fontSize = "14px";
  overlay.style.lineHeight = "1.5";
  overlay.style.borderRadius = "6px";

  overlay.innerText = newText;

  // Click overlay to close it
  overlay.addEventListener("click", () => {
    overlay.remove();
  });

  document.body.appendChild(overlay);
}
