document.addEventListener("mouseup", async () => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (selectedText.length > 0) {

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

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
    createOverlay(rect, data.output);
  }
});

function createOverlay(rect, newText) {
  const overlay = document.createElement("div");

  overlay.style.position = "absolute";
  overlay.style.top = window.scrollY + rect.top + "px";
  overlay.style.left = window.scrollX + rect.left + "px";
  overlay.style.width = rect.width + "px";
  overlay.style.background = "#fff8dc";
  overlay.style.padding = "6px";
  overlay.style.border = "2px solid black";
  overlay.style.zIndex = 9999;
  overlay.style.boxShadow = "0px 4px 12px rgba(0,0,0,0.2)";
  overlay.style.fontSize = "14px";
  overlay.style.lineHeight = "1.4";

  overlay.innerText = newText;

  overlay.addEventListener("click", () => {
    overlay.remove();
  });

  document.body.appendChild(overlay);
}
