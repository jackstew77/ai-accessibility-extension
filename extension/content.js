// ==============================
// ClariFi Academic Tools — content.js
// ==============================

// -----------------------------
// CONFIG — update these values
// Get your API_SECRET from your Render environment variables
// -----------------------------
const CONFIG = {
  BACKEND_URL: "https://ai-accessibility-extension.onrender.com",
  API_SECRET: "YOUR_API_SECRET_HERE",
};

// -----------------------------
// Load saved classroom code on startup
// -----------------------------
let CLASSROOM_CODE = null;

chrome.storage.local.get(["classroomCode"], function (result) {
  if (result.classroomCode) {
    CLASSROOM_CODE = result.classroomCode;
  }
});

// ==============================
// HOTKEY (Ctrl + Shift + L)
// ==============================
document.addEventListener("keydown", async (event) => {
  if (!(event.ctrlKey && event.shiftKey && event.key === "L")) return;

  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (!selectedText || selectedText.length < 5) return;

  const range = selection.getRangeAt(0);
  showMainOverlay(selectedText, range);
});

// ==============================
// MAIN MODAL
// ==============================
function showMainOverlay(selectedText, range) {
  removeOverlay();

  const overlay = document.createElement("div");
  overlay.id = "ai-overlay";

  overlay.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 460px;
    background: #f9fbff;
    padding: 24px;
    border-radius: 16px;
    box-shadow: 0 12px 35px rgba(0,0,0,0.15);
    z-index: 2147483647;
    font-family: Arial, sans-serif;
  `;

  overlay.innerHTML = `
    <div style="font-size:18px; font-weight:600; color:#1f3c88; margin-bottom:16px;">
      ClariFi Academic Tools
    </div>

    <div style="margin-bottom:16px;">
      <label style="font-weight:500;">Classroom Code:</label>
      <input id="clarifi-classroom-input"
        type="text"
        placeholder="Enter classroom code"
        style="width:100%; padding:8px; margin-top:6px; box-sizing:border-box;">
      <button id="clarifi-save-classroom"
        style="margin-top:8px; padding:6px 10px; cursor:pointer;">
        Save Code
      </button>
    </div>

    <label style="font-weight:500;">Mode:</label>
    <select id="clarifi-mode-select" style="width:100%; padding:10px; margin:8px 0 16px 0;">
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

    <div id="clarifi-lexile-container">
      <label style="font-weight:500;">Lexile Level:</label>
      <select id="clarifi-level-select" style="width:100%; padding:10px; margin:8px 0 16px 0;">
        <option value="early">Early Reader (BR–400L)</option>
        <option value="elementary">Elementary (400L–800L)</option>
        <option value="middle" selected>Middle School (800L–1100L)</option>
        <option value="high">High School (1100L–1300L)</option>
        <option value="advanced">Advanced (1300L–1600L)</option>
      </select>
    </div>

    <div id="clarifi-custom-container" style="display:none;">
      <textarea id="clarifi-custom-prompt"
        rows="3"
        style="width:100%; padding:10px; margin-bottom:16px; box-sizing:border-box;"
        placeholder="Enter your custom instruction...">
      </textarea>
    </div>

    <div style="text-align:right;">
      <button id="clarifi-apply-btn" style="
        background:#2c6ecb;
        color:white;
        border:none;
        padding:10px 18px;
        border-radius:8px;
        cursor:pointer;">
        Apply
      </button>
      <button id="clarifi-cancel-btn" style="
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

  // Populate saved classroom code
  const classroomInput = document.getElementById("clarifi-classroom-input");
  if (CLASSROOM_CODE) {
    classroomInput.value = CLASSROOM_CODE;
  }

  // Save classroom code button
  document.getElementById("clarifi-save-classroom").onclick = () => {
    const value = classroomInput.value.trim().toUpperCase();
    chrome.storage.local.set({ classroomCode: value }, function () {
      CLASSROOM_CODE = value;
      alert("Classroom code saved.");
    });
  };

  // Show/hide Lexile and custom prompt sections based on mode
  const modeSelect = document.getElementById("clarifi-mode-select");
  const customContainer = document.getElementById("clarifi-custom-container");
  const lexileContainer = document.getElementById("clarifi-lexile-container");

  modeSelect.addEventListener("change", () => {
    customContainer.style.display = modeSelect.value === "custom" ? "block" : "none";
    lexileContainer.style.display  = modeSelect.value === "simplify" ? "block" : "none";
  });

  document.getElementById("clarifi-cancel-btn").onclick = () => removeOverlay();

  // ==============================
  // APPLY BUTTON
  // ==============================
  document.getElementById("clarifi-apply-btn").onclick = async () => {
    const mode = modeSelect.value;

    // Read aloud is handled entirely in the browser — no server needed
    if (mode === "read") {
      showLanguageSelector(selectedText);
      return;
    }

    chrome.storage.local.get(["classroomCode"], async function (result) {
      const savedCode = result.classroomCode || null;

      // Disable apply button and show loading state
      const applyBtn = document.getElementById("clarifi-apply-btn");
      if (applyBtn) {
        applyBtn.disabled = true;
        applyBtn.textContent = "Processing...";
        applyBtn.style.opacity = "0.6";
        applyBtn.style.cursor = "default";
      }

      showLoadingOverlay();

      try {
        const response = await fetch(`${CONFIG.BACKEND_URL}/transform`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": CONFIG.API_SECRET,
          },
          body: JSON.stringify({
            text: selectedText,
            mode: mode,
            level: document.getElementById("clarifi-level-select")?.value,
            custom_prompt:
              mode === "custom"
                ? document.getElementById("clarifi-custom-prompt").value
                : null,
            classroom_code: savedCode,
          }),
        });

        if (!response.ok) {
          showResultOverlay("❌ Server error. Please try again.", range);
          return;
        }

        const data = await response.json();

        if (data.error) {
          showResultOverlay("❌ " + data.error, range);
          return;
        }

        if (!data.output) {
          showResultOverlay("❌ Unexpected server response.", range);
          return;
        }

        showResultOverlay(data.output, range);

      } catch (err) {
        showResultOverlay("❌ Connection failed. Is your backend running?", range);
      }
    });
  };
}

// ==============================
// LOADING OVERLAY
// ==============================
function showLoadingOverlay() {
  removeOverlay();

  const overlay = document.createElement("div");
  overlay.id = "ai-overlay";

  overlay.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 300px;
    background: white;
    padding: 36px 24px;
    border-radius: 16px;
    box-shadow: 0 12px 35px rgba(0,0,0,0.15);
    z-index: 2147483647;
    font-family: Arial, sans-serif;
    text-align: center;
  `;

  overlay.innerHTML = `
    <div style="
      width: 36px;
      height: 36px;
      border: 3px solid #e6eef8;
      border-top-color: #2c6ecb;
      border-radius: 50%;
      animation: clarifi-spin 0.8s linear infinite;
      margin: 0 auto 16px;
    "></div>
    <p style="color:#1f3c88; font-weight:600; margin-bottom:4px;">Transforming with AI</p>
    <p style="color:#7d8590; font-size:13px;">This usually takes a few seconds…</p>
    <style>
      @keyframes clarifi-spin {
        to { transform: rotate(360deg); }
      }
    </style>
  `;

  document.body.appendChild(overlay);
}

// ==============================
// RESULT MODAL
// ==============================
function showResultOverlay(text, range) {
  removeOverlay();

  const overlay = document.createElement("div");
  overlay.id = "ai-overlay";

  overlay.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 520px;
    background: white;
    padding: 24px;
    border-radius: 16px;
    box-shadow: 0 12px 35px rgba(0,0,0,0.2);
    z-index: 2147483647;
    font-family: Arial, sans-serif;
  `;

  // Build the overlay structure without using innerHTML for user content
  // This prevents XSS if the AI returns any HTML tags
  const outputDiv = document.createElement("div");
  outputDiv.style.cssText = "max-height:320px; overflow:auto; margin-bottom:18px; white-space:pre-wrap; line-height:1.6; font-size:14px; color:#1f2937;";
  outputDiv.textContent = text; // textContent is safe — no HTML execution

  const buttonsDiv = document.createElement("div");
  buttonsDiv.style.textAlign = "right";

  const replaceBtn = document.createElement("button");
  replaceBtn.textContent = "Replace";
  replaceBtn.style.cssText = "background:#2c6ecb; color:white; border:none; padding:10px 18px; border-radius:8px; cursor:pointer;";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.style.cssText = "background:#e6eef8; color:#2c6ecb; border:none; padding:10px 18px; border-radius:8px; margin-left:10px; cursor:pointer;";

  // Copy button
  const copyBtn = document.createElement("button");
  copyBtn.textContent = "Copy";
  copyBtn.style.cssText = "background:#f0f4f8; color:#444; border:none; padding:10px 18px; border-radius:8px; margin-left:10px; cursor:pointer;";

  buttonsDiv.appendChild(replaceBtn);
  buttonsDiv.appendChild(copyBtn);
  buttonsDiv.appendChild(closeBtn);
  overlay.appendChild(outputDiv);
  overlay.appendChild(buttonsDiv);

  document.body.appendChild(overlay);

  closeBtn.onclick = () => removeOverlay();

  copyBtn.onclick = () => {
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.textContent = "Copy"; }, 2000);
    });
  };

  replaceBtn.onclick = () => {
    try {
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
    } catch (e) {
      alert("Could not replace text on this page.");
    }
    removeOverlay();
  };
}

// ==============================
// LANGUAGE SELECTOR (Read Aloud)
// ==============================
function showLanguageSelector(text) {
  removeOverlay();

  const overlay = document.createElement("div");
  overlay.id = "ai-overlay";

  overlay.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 300px;
    background: white;
    padding: 20px;
    border-radius: 14px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    z-index: 2147483647;
    font-family: Arial, sans-serif;
  `;

  overlay.innerHTML = `
    <select id="clarifi-voice-language" style="width:100%; padding:8px; margin-bottom:14px;">
      <option value="en-US">English</option>
      <option value="es-ES">Spanish</option>
      <option value="fr-FR">French</option>
      <option value="de-DE">German</option>
    </select>
    <button id="clarifi-speak-btn" style="width:100%; padding:8px; cursor:pointer;">
      Start Reading
    </button>
    <button id="clarifi-stop-btn" style="width:100%; padding:8px; margin-top:8px; cursor:pointer; display:none;">
      Stop Reading
    </button>
  `;

  document.body.appendChild(overlay);

  document.getElementById("clarifi-speak-btn").onclick = () => {
    const lang = document.getElementById("clarifi-voice-language").value;
    speakText(text, lang);
    document.getElementById("clarifi-speak-btn").style.display = "none";
    document.getElementById("clarifi-stop-btn").style.display = "block";
  };

  document.getElementById("clarifi-stop-btn").onclick = () => {
    window.speechSynthesis.cancel();
    removeOverlay();
  };
}

// ==============================
// SPEECH FUNCTION
// ==============================
function speakText(text, language = "en-US") {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  utterance.onend = () => removeOverlay();
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

// ==============================
// CLEANUP
// ==============================
function removeOverlay() {
  const existing = document.getElementById("ai-overlay");
  if (existing) existing.remove();
  window.speechSynthesis.cancel();
}
