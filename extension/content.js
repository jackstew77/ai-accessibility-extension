document.addEventListener("keydown", async (event) => {

  if (!(event.ctrlKey && event.shiftKey && event.key === "L")) return;

  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  if (!selectedText || selectedText.length < 5) return;

  const range = selection.getRangeAt(0);
  showCenteredOverlay(selectedText, range);
});


function showCenteredOverlay(selectedText, range) {
  removeExistingOverlay();

  const overlay = document.createElement("div");
  overlay.id = "ai-overlay";

  overlay.style.position = "fixed";
  overlay.style.top = "50%";
  overlay.style.left = "50%";
  overlay.style.transform = "translate(-50%, -50%)";
  overlay.style.width = "420px";
  overlay.style.background = "#f9fbff";
  overlay.style.padding = "20px";
  overlay.style.border = "1px solid #d0dbe8";
  overlay.style.zIndex = 9999;
  overlay.style.boxShadow = "0px 10px 30px rgba(0,0,0,0.15)";
  overlay.style.borderRadius = "14px";
  overlay.style.fontFamily = "Arial, sans-serif";

  overlay.innerHTML = `
    <div style="font-weight:600; font-size:18px; margin-bottom:16px; color:#1f3c88;">
      ClariFi Academic Tools
    </div>

    <label style="font-weight:500;">Mode:</label>
    <select id="mode-select" style="width:100%; padding:8px; margin:8px 0 12px 0;">
      <option value="simplify">Simplify (Lexile)</option>
      <option value="study_guide">Create Study Guide</option>
      <option value="quiz">Generate Quiz</option>
      <option value="vocabulary">Extract Vocabulary</option>
      <option value="discussion">Discussion Questions</option>
      <option value="cornell">Cornell Notes</option>
      <option value="summarize">Summarize</option>
      <option value="explain">Explain</option>
      <option value="translate">Translate (Spanish)</option>
      <option value="custom">Custom Prompt</option>
      <option value="read">🔊 Read Aloud</option>
    </select>

    <div id="lexile-container">
      <label style="font-weight:500;">Lexile Level:</label>
      <select id="level-select" style="width:100%; padding:8px; margin:8px 0 12px 0;">
        <option value="early">Early Reader (BR–400L)</option>
        <option value="elementary" selected>Elementary (400L–800L)</option>
        <option value="middle">Middle School (800L–1100L)</option>
        <option value="high">High School (1100L–1300L)</option>
        <option value="advanced">Advanced (1300L–1600L)</option>
      </select>
    </div>

    <div id="custom-container" style="display:none;">
      <textarea id="custom-prompt" rows="3"
        style="width:100%; padding:8px; margin-bottom:12px;"
        placeholder="Enter your custom instruction..."></textarea>
    </div>

    <div style="text-align:right;">
      <button id="apply-btn" style="
        background:#2c6ecb;
        color:white;
        border:none;
        padding:10px 16px;
        border-radius:6px;
        cursor:pointer;">
        Apply
      </button>

      <button id="close-btn" style="
        background:#e6eef8;
        color:#2c6ecb;
        border:none;
        padding:10px 16px;
        border-radius:6px;
        margin-left:8px;
        cursor:pointer;">
        Cancel
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  const modeSelect = document.getElementById("mode-select");
  const customContainer = document.getElementById("custom-container");
  const lexileContainer = document.getElementById("lexile-container");

  modeSelect.addEventListener("change", () => {
    customContainer.style.display =
      modeSelect.value === "custom" ? "block" : "none";

    lexileContainer.style.display =
      modeSelect.value === "simplify" ? "block" : "none";
  });

  document.getElementById("close-btn").onclick = () => overlay.remove();

  document.getElementById("apply-btn").onclick = async () => {

    const mode = modeSelect.value;

    if (mode === "read") {
      showLanguageSelector(selectedText);
      return;
    }

    overlay.innerHTML = "<div style='text-align:center;'>Processing...</div>";

    const response = await fetch(
      "https://ai-accessibility-extension.onrender.com/transform",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: selectedText,
          mode: mode,
          level: document.getElementById("level-select")?.value,
          custom_prompt:
            mode === "custom"
              ? document.getElementById("custom-prompt").value
              : null
        })
      }
    );

    const data = await response.json();

    showResultOverlay(data.output || "Error occurred", range);
  };
}


function showResultOverlay(text, range) {
  removeExistingOverlay();

  const overlay = document.createElement("div");
  overlay.id = "ai-overlay";

  overlay.style = `
    position:fixed;
    top:50%;
    left:50%;
    transform:translate(-50%, -50%);
    width:500px;
    background:white;
    padding:20px;
    border-radius:14px;
    box-shadow:0 10px 30px rgba(0,0,0,0.2);
    z-index:9999;
    font-family:Arial;
  `;

  overlay.innerHTML = `
    <div style="margin-bottom:16px; max-height:300px; overflow:auto;">
      ${text}
    </div>

    <div style="text-align:right;">
      <button id="replace-btn" style="
        background:#2c6ecb;
        color:white;
        border:none;
        padding:10px 16px;
        border-radius:6px;
        cursor:pointer;">
        Replace
      </button>

      <button id="close-btn" style="
        background:#e6eef8;
        color:#2c6ecb;
        border:none;
        padding:10px 16px;
        border-radius:6px;
        margin-left:8px;
        cursor:pointer;">
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


function showLanguageSelector(text) {
  removeExistingOverlay();

  const overlay = document.createElement("div");
  overlay.id = "ai-overlay";

  overlay.style = `
    position:fixed;
    top:50%;
    left:50%;
    transform:translate(-50%, -50%);
    width:300px;
    background:white;
    padding:20px;
    border-radius:12px;
    box-shadow:0 10px 30px rgba(0,0,0,0.2);
    z-index:9999;
  `;

  overlay.innerHTML = `
    <select id="voice-language" style="width:100%; padding:8px; margin-bottom:12px;">
      <option value="en-US">English</option>
      <option value="es-ES">Spanish</option>
      <option value="fr-FR">French</option>
      <option value="de-DE">German</option>
    </select>

    <button id="speak-btn" style="width:100%; padding:8px;">Start Reading</button>
  `;

  document.body.appendChild(overlay);

  document.getElementById("speak-btn").onclick = () => {
    speakText(text, document.getElementById("voice-language").value);
    overlay.remove();
  };
}


function speakText(text, language = "en-US") {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}


function removeExistingOverlay() {
  const existing = document.getElementById("ai-overlay");
  if (existing) existing.remove();
}
