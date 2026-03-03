from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from supabase import create_client
import os

app = FastAPI()

# -----------------------------
# CORS (Allow extension access)
# -----------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# ENV VARIABLES
# -----------------------------
OPENAI_KEY = os.environ["OPENAI_API_KEY"]
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_KEY"]

client = OpenAI(api_key=OPENAI_KEY)
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
# Health Check Route
# -----------------------------
@app.get("/")
def health():
    return {"status": "Backend running"}


# -----------------------------
# Main Transform Route
# -----------------------------
@app.post("/transform")
async def transform_text(request: TextRequest):
    try:

        classroom = None

        # -----------------------------------
        # FETCH CLASSROOM RULES (If Provided)
        # -----------------------------------
        if request.classroom_code:

            response = supabase.table("classrooms") \
                .select("*") \
                .eq("code", request.classroom_code) \
                .execute()

            if not response.data:
                return {"error": "Invalid classroom code."}

            classroom = response.data[0]

            # -----------------------------
            # ENFORCEMENT RULES
            # -----------------------------

            # 1️⃣ Enforce allowed modes
            if request.mode not in classroom["allowed_modes"]:
                return {"error": "This mode is not allowed in this classroom."}

            # 2️⃣ Enforce custom prompt restriction
            if request.mode == "custom" and not classroom["allow_custom"]:
                return {"error": "Custom prompts are not allowed in this classroom."}

            # 3️⃣ Enforce locked lexile
            if classroom["locked_lexile"]:
                request.level = classroom["locked_lexile"]

        # -----------------------------------
        # PROMPT GENERATION LOGIC
        # -----------------------------------

        system_prompt = None

        if request.mode == "custom":
            if not request.custom_prompt:
                return {"error": "No custom prompt provided."}
            system_prompt = request.custom_prompt

        elif request.mode == "simplify":
            lexile_prompts = {
                "early": "Rewrite at Lexile BR–400L level using very simple vocabulary.",
                "elementary": "Rewrite at 400L–800L Lexile level for elementary students.",
                "middle": "Rewrite at 800L–1100L Lexile level for middle school students.",
                "high": "Rewrite at 1100L–1300L Lexile level for high school students.",
                "advanced": "Rewrite at 1300L–1600L Lexile level with academic precision."
            }
            system_prompt = lexile_prompts.get(
                request.level,
                lexile_prompts["elementary"]
            )

        elif request.mode == "study_guide":
            system_prompt = "Turn this into a structured study guide with headings and bullet points."

        elif request.mode == "quiz":
            system_prompt = "Create 5 multiple choice quiz questions with answer key."

        elif request.mode == "vocabulary":
            system_prompt = "Extract 5 academic vocabulary words and define them clearly."

        elif request.mode == "discussion":
            system_prompt = "Create 5 thoughtful discussion questions."

        elif request.mode == "cornell":
            system_prompt = "Rewrite this into Cornell Notes format."

        elif request.mode == "summarize":
            system_prompt = "Summarize clearly for students."

        elif request.mode == "explain":
            system_prompt = "Explain clearly in student-friendly language."

        elif request.mode == "translate":
            system_prompt = "Translate this into Spanish."

        else:
            system_prompt = "Rewrite clearly."

        # -----------------------------------
        # CALL OPENAI
        # -----------------------------------
        ai_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.text}
            ]
        )

        return {"output": ai_response.choices[0].message.content}

    except Exception as e:
        return {"error": str(e)}
