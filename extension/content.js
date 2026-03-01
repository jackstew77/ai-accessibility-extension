document.addEventListener("keydown", async (event) => {

  if (!(event.ctrlKey && event.shiftKey && event.key === "L")) return;

  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  if (!selectedText || selectedText.length < 5) return;

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
    <div style="font-weight:600; font-size:16px; margin-bottom:14px; color:#1f3c88;">
      ClariFi Education Tools
    </div>

    <div style="margin-bottom:10px;">
      <label style="font-weight:500;">Mode:</label><br/>
      <select id="mode-select" style="width:100%; padding:6px; margin-top:4px;">
        <option value="simplify">Simplify</option>
        <option value="summarize">Summarize</option>
        <option value="explain">Explain</option>
        <option value="translate">Translate (Spanish)</option>
        <option value="custom">Custom Prompt</option>
        <option value="read">🔊 Read Aloud</option>
      </select>
    </div>

    <div style="margin-bottom:10px;">
      <label style="font-weight:500;">Lexile Level:</label><br/>
      <select id="level-select" style="width:100%; padding:6px; margin-top:4px;">
        <option value="early">Early Reader (BR–400L)</option>
        <option value="elementary" selected>Elementary (400L–800L)</option>
        <option value="middle">Middle School (800L–1100L)</option>
        <option value="high">High School (1100L–1300L)</option>
        <option value="advanced">Advanced (1300L–1600L)</option>
      </select>
    </div>

    <div id="custom-container" style="display:none; margin-bottom:14px;">
      <label style="font-weight:500;">Custom Instruction:</label><br/>
      <textarea id="custom-prompt" rows="3"
        style="width:100%; padding:6px; margin-top:4px; resize:vertical;"
        placeholder="Example: Turn this into bullet points for studying..."></textarea>
    </div>

    <div style="text-align:right;">
      <button id="run-btn" style="
        background:#2c6ecb;
        color:white;
        border:none;
        padding:8px 14px;
        border-radius:6px;
        cursor:pointer;
        font-weight:500;">
        Apply
      </button>

      <button id="close-btn" style="
        background:#e6eef8;
        color:#2c6ecb;
        border:none;
        padding:8px 14px;
        border-radius:6px;
        cursor:pointer;
        margin-left:6px;">
        Cancel
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  const modeSelect = document.getElementById("mode-select");
  const customContainer = document.getElementById("custom-container");

  modeSelect.addEventListener("change", () => {
    customContainer.style.display =
      modeSelect.value === "custom" ? "block" : "none";
  });

  document.getElementById("close-btn").onclick = () => overlay.remove();

  document.getElementById("run-btn").onclick = async () => {

    const mode = modeSelect.value;
    const level = document.getElementById("level-select").value;
    const customPromptValue =
      document.getElementById("custom-prompt")?.value;

    if (mode === "read") {
      showLanguageSelector(rect, selectedText);
      return;
    }

    overlay.innerHTML = "Processing...";

    try {
      const response = await fetch(
        "https://ai-accessibility-extension.onrender.com/transform",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: selectedText,
            mode: mode,
            level: level,
            custom_prompt: mode === "custom" ? customPromptValue : null
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
    <div style="margin-bottom:12px;">${text}</div>

    <div style="text-align:right;">
      <button id="replace-btn" style="
        background:#2c6ecb;
        color:white;
        border:none;
        padding:8px 14px;
        border-radius:6px;
        cursor:pointer;">
        Replace
      </button>

      <button id="close-btn" style="
        background:#e6eef8;
        color:#2c6ecb;
        border:none;
        padding:8px 14px;
        border-radius:6px;
        cursor:pointer;
        margin-left:6px;">
        Close
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("close-btn").onclick = () => overlay.remove();

  document.getElementById("replace-btn").onclick = () => {
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    overlay.remove();
  };
}


function showLanguageSelector(rect, text) {
  removeExistingOverlay();

  const overlay = document.createElement("div");
  overlay.id = "ai-overlay";
  styleOverlay(overlay, rect);

  overlay.innerHTML = `
    <div style="font-weight:600; margin-bottom:14px; color:#1f3c88;">
      Select Reading Language
    </div>

    <select id="voice-language" style="width:100%; padding:6px; margin-bottom:14px;">
      <option value="en-US">English (US)</option>
      <option value="en-GB">English (UK)</option>
      <option value="es-ES">Spanish</option>
      <option value="fr-FR">French</option>
      <option value="de-DE">German</option>
    </select>

    <div style="text-align:right;">
      <button id="speak-btn" style="
        background:#2c6ecb;
        color:white;
        border:none;
        padding:8px 14px;
        border-radius:6px;
        cursor:pointer;">
        Start Reading
      </button>

      <button id="cancel-btn" style="
        background:#e6eef8;
        color:#2c6ecb;
        border:none;
        padding:8px 14px;
        border-radius:6px;
        cursor:pointer;
        margin-left:6px;">
        Cancel
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("cancel-btn").onclick = () => overlay.remove();

  document.getElementById("speak-btn").onclick = () => {
    const language = document.getElementById("voice-language").value;
    speakText(text, language);
    overlay.remove();
  };
}


function speakText(text, language = "en-US") {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;

  const voices = window.speechSynthesis.getVoices();
  const selectedVoice = voices.find(v => v.lang.startsWith(language));

  if (selectedVoice) utterance.voice = selectedVoice;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}


function styleOverlay(overlay, rect) {
  overlay.style.position = "absolute";
  overlay.style.top = window.scrollY + rect.top + "px";
  overlay.style.left = window.scrollX + rect.left + "px";
  overlay.style.width = "360px";
  overlay.style.background = "#f9fbff";
  overlay.style.padding = "18px";
  overlay.style.border = "1px solid #d0dbe8";
  overlay.style.zIndex = 9999;
  overlay.style.boxShadow = "0px 8px 24px rgba(0,0,0,0.08)";
  overlay.style.fontSize = "14px";
  overlay.style.lineHeight = "1.6";
  overlay.style.borderRadius = "12px";
  overlay.style.fontFamily = "Arial, sans-serif";
}


function removeExistingOverlay() {
  const existing = document.getElementById("ai-overlay");
  if (existing) existing.remove();
}
