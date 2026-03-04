from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from supabase import create_client
import os

app = FastAPI()

# -----------------------------
# CORS
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

print("DEBUG SUPABASE URL:", SUPABASE_URL)

client = OpenAI(api_key=OPENAI_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# -----------------------------
# Request Models
# -----------------------------
class TextRequest(BaseModel):
    text: str
    mode: str = "simplify"
    level: str = "elementary"
    custom_prompt: str | None = None
    classroom_code: str | None = None


class CreateClassroom(BaseModel):
    class_name: str
    allowed_modes: list
    locked_lexile: str | None = None
    allowed_custom: bool = False


class DeleteClassroom(BaseModel):
    code: str


# -----------------------------
# Health Check
# -----------------------------
@app.get("/")
def health():
    return {"status": "Backend running"}


# -----------------------------
# Get All Classrooms
# -----------------------------
@app.get("/classrooms")
def get_classrooms():
    result = supabase.table("classrooms").select("*").execute()
    return result.data


# -----------------------------
# Create Classroom
# -----------------------------
@app.post("/create_classroom")
def create_classroom(data: CreateClassroom):

    import random
    import string

    prefix = data.class_name[:5].upper().replace(" ", "")

    code = prefix + "-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=4))

    supabase.table("classrooms").insert({
        "class_name": data.class_name,
        "code": code,
        "allowed_modes": data.allowed_modes,
        "locked_lexile": data.locked_lexile,
        "allowed_custom": data.allowed_custom
    }).execute()

    return {"code": code}


# -----------------------------
# Delete Classroom
# -----------------------------
@app.post("/delete_classroom")
def delete_classroom(data: DeleteClassroom):

    supabase.table("classrooms").delete().eq("code", data.code).execute()

    return {"status": "deleted"}


# -----------------------------
# Transform Route
# -----------------------------
@app.post("/transform")
async def transform_text(request: TextRequest):

    try:

        print("\n--- NEW REQUEST ---")
        print("Raw classroom code:", request.classroom_code)

        classroom = None

        all_rows = supabase.table("classrooms").select("*").execute()
        print("DEBUG ALL ROWS:", all_rows.data)

        if not all_rows.data:
            return {"error": "No rows exist in classrooms table."}

        incoming_code = (request.classroom_code or "").strip().upper()
        print("Normalized incoming code:", incoming_code)

        match = None

        for row in all_rows.data:
            db_code = (row.get("code") or "").strip().upper()
            print("Checking DB code:", db_code)

            if db_code == incoming_code:
                match = row
                break

        if not match:
            return {"error": f"No match found for code: {incoming_code}"}

        classroom = match
        print("MATCH FOUND:", classroom)

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
                "early": "Rewrite at Lexile BR–400L level.",
                "elementary": "Rewrite at 400L–800L level.",
                "middle": "Rewrite at 800L–1100L level.",
                "high": "Rewrite at 1100L–1300L level.",
                "advanced": "Rewrite at 1300L–1600L level."
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
            system_prompt = "Summarize this text clearly."

        elif request.mode == "explain":
            system_prompt = "Explain this text in simple terms."

        elif request.mode == "translate":
            system_prompt = "Translate this text to Spanish."

        else:
            system_prompt = "Rewrite clearly."

        # -----------------------------
        # Call OpenAI
        # -----------------------------

        ai_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.text}
            ]
        )

        return {"output": ai_response.choices[0].message.content}

    except Exception as e:

        print("SERVER ERROR:", str(e))

        return {"error": str(e)}
