from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from supabase import create_client
import os
import logging

# -----------------------------
# Logging (replaces print/debug)
# -----------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# -----------------------------
# CORS — locked to your extension
# Replace YOUR_EXTENSION_ID with your real Chrome extension ID
# You can find it at chrome://extensions after loading unpacked
# -----------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "chrome-extension://YOUR_EXTENSION_ID",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "x-api-key"],
)

# -----------------------------
# ENV VARIABLES
# Add API_SECRET to your Render environment variables
# (any long random string, e.g. from https://generate-secret.vercel.app/32)
# -----------------------------
OPENAI_KEY    = os.environ["OPENAI_API_KEY"]
SUPABASE_URL  = os.environ["SUPABASE_URL"]
SUPABASE_KEY  = os.environ["SUPABASE_KEY"]
API_SECRET    = os.environ["API_SECRET"]

client   = OpenAI(api_key=OPENAI_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# -----------------------------
# Request Model
# -----------------------------
class TextRequest(BaseModel):
    text: str
    mode: str = "simplify"
    level: str = "elementary"
    custom_prompt: str | None = None
    classroom_code: str | None = None

# -----------------------------
# Health Check
# -----------------------------
@app.get("/")
def health():
    return {"status": "Backend running"}

# -----------------------------
# Transform Route
# -----------------------------
@app.post("/transform")
async def transform_text(
    request: TextRequest,
    x_api_key: str = Header(None)
):
    # -----------------------------
    # Authentication
    # -----------------------------
    if x_api_key != API_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        logger.info("New /transform request — mode: %s", request.mode)

        # -----------------------------
        # Supabase lookup — filter in DB, not in Python
        # -----------------------------
        incoming_code = (request.classroom_code or "").strip().upper()

        if not incoming_code:
            return {"error": "No classroom code provided."}

        result = supabase.table("classrooms") \
            .select("*") \
            .ilike("code", incoming_code) \
            .execute()

        if not result.data:
            return {"error": f"No classroom found for code: {incoming_code}"}

        classroom = result.data[0]
        logger.info("Classroom matched: %s", classroom.get("code"))

        # -----------------------------
        # Governance Enforcement
        # -----------------------------
        allowed_modes = classroom.get("allowed_modes") or []

        if request.mode not in allowed_modes:
            return {"error": "This mode is not allowed in this classroom."}

        if request.mode == "custom" and not classroom.get("allowed_custom"):
            return {"error": "Custom prompts are not allowed in this classroom."}

        if classroom.get("locked_lexile"):
            request.level = classroom["locked_lexile"]

        # -----------------------------
        # Prompt Logic
        # -----------------------------
        if request.mode == "custom":
            if not request.custom_prompt:
                return {"error": "No custom prompt provided."}
            system_prompt = request.custom_prompt

        elif request.mode == "simplify":
            lexile_prompts = {
                "early":       "Rewrite this text for a very early reader at Lexile BR–400L. Use short sentences, simple words, and be friendly.",
                "elementary":  "Rewrite this text at a 400L–800L Lexile level, suitable for elementary school students.",
                "middle":      "Rewrite this text at an 800L–1100L Lexile level, suitable for middle school students.",
                "high":        "Rewrite this text at a 1100L–1300L Lexile level, suitable for high school students.",
                "advanced":    "Rewrite this text at a 1300L–1600L Lexile level for advanced readers.",
            }
            system_prompt = lexile_prompts.get(request.level, lexile_prompts["elementary"])

        elif request.mode == "study_guide":
            system_prompt = "Turn the following text into a structured study guide with clear headings and bullet points."

        elif request.mode == "quiz":
            system_prompt = "Create 5 multiple choice quiz questions based on this text. Include an answer key at the end."

        elif request.mode == "vocabulary":
            system_prompt = "Extract 5 important academic vocabulary words from this text and define each one clearly for a student."

        elif request.mode == "discussion":
            system_prompt = "Create 5 thoughtful discussion questions based on this text that encourage critical thinking."

        elif request.mode == "cornell":
            system_prompt = "Rewrite this text in Cornell Notes format with a Cues column, Notes column, and a Summary section at the bottom."

        elif request.mode == "summarize":
            system_prompt = "Summarize the following text concisely in 3–5 sentences, capturing the main ideas."

        elif request.mode == "explain":
            system_prompt = "Explain the following text clearly and simply, as if to a curious student encountering it for the first time."

        elif request.mode == "translate":
            system_prompt = "Translate the following text into Spanish accurately, preserving the original meaning and tone."

        else:
            return {"error": f"Unknown mode: {request.mode}"}

        # -----------------------------
        # Call OpenAI
        # -----------------------------
        ai_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": request.text}
            ]
        )

        output = ai_response.choices[0].message.content
        logger.info("Transform successful — mode: %s", request.mode)
        return {"output": output}

    except Exception as e:
        logger.error("Server error: %s", str(e))
        return {"error": "An internal server error occurred. Please try again."}
