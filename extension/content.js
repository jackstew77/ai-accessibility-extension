// Listen for hotkey: Ctrl + Shift + L
document.addEventListener("keydown", async function (event) {
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "l") {
    const selectedText = window.getSelection().toString().trim();
    if (!selectedText) {
      alert("Please highlight text first.");
      return;
    }

    const range = window.getSelection().getRangeAt(0);

    openControlPanel(selectedText, range);
  }
});

function openControlPanel(selectedText, range) {
  const panel = document.createElement("div");
  panel.style.position = "fixed";
  panel.style.top = "20%";
  panel.style.left = "50%";
  panel.style.transform = "translateX(-50%)";
  panel.style.background = "white";
  panel.style.padding = "20px";
  panel.style.border = "2px solid black";
  panel.style.zIndex = "999999";
  panel.style.width = "400px";

  panel.innerHTML = `
    <h3>AI Academic Tools</h3>

    <label>Mode:</label>
    <select id="mode">
      <option value="simplify">Simplify</option>
      <option value="study_guide">Study Guide</option>
      <option value="quiz">Quiz</option>
      <option value="vocabulary">Vocabulary</option>
      <option value="discussion">Discussion</option>
      <option value="custom">Custom Prompt</option>
    </select>

    <br><br>

    <label>Lexile Level:</label>
    <select id="level">
      <option value="early">Early</option>
      <option value="elementary" selected>Elementary</option>
      <option value="middle">Middle</option>
      <option value="high">High</option>
      <option value="advanced">Advanced</option>
    </select>

    <br><br>

    <label>Custom Prompt:</label>
    <textarea id="customPrompt" rows="3" style="width:100%;"></textarea>

    <br><br>

    <label>Classroom Code:</label>
    <input type="text" id="classroomCode" style="width:100%;" />

    <br><br>

    <button id="submitBtn">Run</button>
    <button id="closeBtn">Cancel</button>
  `;

  document.body.appendChild(panel);

  document.getElementById("closeBtn").onclick = () => {
    panel.remove();
  };

  document.getElementById("submitBtn").onclick = async () => {
    const selectedMode = document.getElementById("mode").value;
    const selectedLevel = document.getElementById("level").value;
    const customPrompt = document.getElementById("customPrompt").value;
    const classroomCode = document.getElementById("classroomCode").value;

    panel.remove();

    await sendRequest(
      selectedText,
      selectedMode,
      selectedLevel,
      customPrompt,
      classroomCode,
      range
    );
  };
}

async function sendRequest(
  selectedText,
  selectedMode,
  selectedLevel,
  customPrompt,
  classroomCode,
  range
) {
  try {
    const response = await fetch(
      "https://ai-accessibility-extension.onrender.com/transform",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: selectedText,
          mode: selectedMode,
          level: selectedLevel,
          custom_prompt: customPrompt,
          classroom_code: classroomCode
        })
      }
    );

    const data = await response.json();

    // ✅ Proper error handling
    if (data.error) {
      showResultOverlay("❌ " + data.error, range);
    } else {
      showResultOverlay(data.output, range);
    }

  } catch (err) {
    showResultOverlay("❌ Connection failed.", range);
  }
}

function showResultOverlay(resultText, range) {
  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.background = "white";
  overlay.style.border = "2px solid black";
  overlay.style.padding = "15px";
  overlay.style.zIndex = "999999";
  overlay.style.maxWidth = "500px";
  overlay.style.whiteSpace = "pre-wrap";

  const rect = range.getBoundingClientRect();
  overlay.style.top = window.scrollY + rect.bottom + 10 + "px";
  overlay.style.left = window.scrollX + rect.left + "px";

  overlay.innerText = resultText;

  overlay.onclick = () => overlay.remove();

  document.body.appendChild(overlay);
}
