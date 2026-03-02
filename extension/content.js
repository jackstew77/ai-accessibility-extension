// =============================
// 🔥 PHASE 2 – GOVERNED VERSION
// =============================

const CLASSROOM_CODE = "ENG102-A7X9"; // 🔐 Hardcoded for Phase 2 testing


document.addEventListener("keydown", async (event) => {
  if (!(event.ctrlKey && event.shiftKey && event.key === "L")) return;

  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  if (!selectedText || selectedText.length < 5) return;

  const range = selection.getRangeAt(0);
  showMainOverlay(selectedText, range);
});


// =============================
// 🎓 MAIN MODAL
// =============================

function showMainOverlay(selectedText, range) {
  removeOverlay();

  const overlay = document.createElement("div");
  overlay.id = "ai-overlay";

  overlay.style = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 450px;
    background: #f9fbff;
    padding: 24px;
    border-radius: 16px;
    box-shadow: 0 12px 35px rgba(0,0,0,0.15);
    z-index: 9999;
    font-family: Arial, sans-serif;
  `;

  overlay.innerHTML = `
    <div style="font-size:18px; font-weight:600; color:#1f3c88; margin-bottom:18px;">
      ClariFi Academic Tools
    </div>

    <label style="font-weight:500;">Mode:</label>
    <select id="mode-select" style="width:100%; padding:10px; margin:8px 0 16px 0;">
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
      <select id="level-select" style="width:100%; padding:10px; margin:8px 0 16px 0;">
        <option value="early">Early Reader (BR–400L)</option>
        <option value="elementary">Elementary (400L–800L)</option>
        <option value="middle" selected>Middle School (800L–1100L)</option>
        <option value="high">High School (1100L–1300L)</option>
        <option value="advanced">Advanced (1300L–1600L)</option>
      </select>
    </div>

    <div id="custom-container" style="display:none;">
      <textarea id="custom-prompt"
        rows="3"
        style="width:100%; padding:10px; margin-bottom:16px;"
        placeholder="Enter your custom instruction...">
      </textarea>
    </div>

    <div style="text-align:right;">
      <button id="apply-btn" style="
        background:#2c6ecb;
        color:white;
        border:none;
        padding:10px 18px;
        border-radius:8px;
        cursor:pointer;">
        Apply
      </button>

      <button id="cancel-btn" style="
        background:#e6eef8;
        color:#2c6ecb;
        border:none;
        padding:10px 18px;
        border-radius:8px;
        margin-left:10px;
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

  document.getElementById("cancel-btn").onclick = () => removeOverlay();

  document.getElementById("apply-btn").onclick = async () => {

    const mode = modeSelect.value;

    if (mode === "read") {
      showLanguageSelector(selectedText);
      return;
    }

    overlay.innerHTML = `
      <div style="text-align:center; padding:20px;">
        Processing...
      </div>
    `;

    try {
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
                : null,
            classroom_code: CLASSROOM_CODE
          })
        }
      );

      const data = await response.json();

      if (data.error) {
        showResultOverlay("❌ " + data.error, range);
      } else {
        showResultOverlay(data.output, range);
      }

    } catch (err) {
      showResultOverlay("Connection failed.", range);
    }
  };
}


// =============================
// 📄 RESULT MODAL
// =============================

function showResultOverlay(text, range) {
  removeOverlay();

  const overlay = document.createElement("div");
  overlay.id = "ai-overlay";

  overlay.style = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 520px;
    background: white;
    padding: 24px;
    border-radius: 16px;
    box-shadow: 0 12px 35px rgba(0,0,0,0.2);
    z-index: 9999;
    font-family: Arial, sans-serif;
  `;

  overlay.innerHTML = `
    <div style="max-height:320px; overflow:auto; margin-bottom:18px;">
      ${text}
    </div>

    <div style="text-align:right;">
      <button id="replace-btn" style="
        background:#2c6ecb;
        color:white;
        border:none;
        padding:10px 18px;
        border-radius:8px;
        cursor:pointer;">
        Replace
      </button>

      <button id="close-btn" style="
        background:#e6eef8;
        color:#2c6ecb;
        border:none;
        padding:10px 18px;
        border-radius:8px;
        margin-left:10px;
        cursor:pointer;">
        Close
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("close-btn").onclick = () => removeOverlay();

  document.getElementById("replace-btn").onclick = () => {
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    removeOverlay();
  };
}


// =============================
// 🔊 LANGUAGE SELECTOR
// =============================

function showLanguageSelector(text) {
  removeOverlay();

  const overlay = document.createElement("div");
  overlay.id = "ai-overlay";

  overlay.style = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 300px;
    background: white;
    padding: 20px;
    border-radius: 14px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    z-index: 9999;
  `;

  overlay.innerHTML = `
    <select id="voice-language" style="width:100%; padding:8px; margin-bottom:14px;">
      <option value="en-US">English</option>
      <option value="es-ES">Spanish</option>
      <option value="fr-FR">French</option>
      <option value="de-DE">German</option>
    </select>

    <button id="speak-btn" style="width:100%; padding:8px;">
      Start Reading
    </button>
  `;

  document.body.appendChild(overlay);

  document.getElementById("speak-btn").onclick = () => {
    speakText(text, document.getElementById("voice-language").value);
    removeOverlay();
  };
}


// =============================
// 🎙 SPEECH FUNCTION
// =============================

function speakText(text, language = "en-US") {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}


// =============================
// 🧹 CLEANUP
// =============================

function removeOverlay() {
  const existing = document.getElementById("ai-overlay");
  if (existing) existing.remove();
}
