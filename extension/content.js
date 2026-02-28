document.addEventListener("mouseup", async () => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (!selectedText || selectedText.length < 20) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  showOptionsOverlay(rect, selectedText, range);
});


function showOptionsOverlay(rect, selectedText, range) {
  removeExistingOverlay();

  const overlay = document.createElement("div");
  overlay.id = "ai-overlay";

  styleOverlay(overlay, rect);

  overlay.innerHTML = `
    <div style="margin-bottom:8px;">
      <label>Mode:</label>
      <select id="mode-select">
        <option value="simplify">Simplify</option>
        <option value="summarize">Summarize</option>
        <option value="explain">Explain</option>
        <option value="translate">Translate (Spanish)</option>
      </select>
    </div>

    <div style="margin-bottom:8px;">
      <label>Reading Level:</label>
      <select id="level-select">
        <option value="3rd grade">3rd Grade</option>
        <option value="5th grade" selected>5th Grade</option>
        <option value="8th grade">8th Grade</option>
        <option value="High School">High School</option>
      </select>
    </div>

    <button id="run-btn" style="margin-right:8px;">Run</button>
    <button id="close-btn">Close</button>
  `;

  document.body.appendChild(overlay);

  document.getElementById("close-btn").onclick = () => overlay.remove();

  document.getElementById("run-btn").onclick = async () => {
    const mode = document.getElementById("mode-select").value;
    const level = document.getElementById("level-select").value;

    overlay.innerHTML = "✨ Processing...";

    try {
      const response = await fetch(
        "https://ai-accessibility-extension.onrender.com/transform",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: selectedText,
            mode: mode,
            level: level
          })
        }
      );

      const data = await response.json();

      if (data.output) {
        showResultOverlay(rect, data.output, range);
      } else {
        showResultOverlay(rect, "Error: " + (data.error || "Unknown error"), range);
      }

    } catch (err) {
      showResultOverlay(rect, "Connection failed.", range);
    }
  };
}


function showResultOverlay(rect, text, range) {
  removeExistingOverlay();

  const overlay = document.createElement("div");
  overlay.id = "ai-overlay";

  styleOverlay(overlay, rect);

  overlay.innerHTML = `
    <div style="margin-bottom:8px;">${text}</div>
    <button id="replace-btn" style="margin-right:8px;">Replace</button>
    <button id="close-btn">Close</button>
  `;

  document.body.appendChild(overlay);

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
  overlay.style.padding = "12px";
  overlay.style.border = "2px solid #333";
  overlay.style.zIndex = 9999;
  overlay.style.boxShadow = "0px 8px 20px rgba(0,0,0,0.25)";
  overlay.style.fontSize = "14px";
  overlay.style.lineHeight = "1.5";
  overlay.style.borderRadius = "8px";
}


function removeExistingOverlay() {
  const existing = document.getElementById("ai-overlay");
  if (existing) existing.remove();
}
