from fastapi import FastAPI, Header
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from supabase import create_client
import os
import uvicorn

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
# AUTH HELPER
# -----------------------------
def get_teacher_id(authorization: str = Header(None)):
    if not authorization:
        return None

    token = authorization.replace("Bearer ", "")
    user = supabase.auth.get_user(token)

    if user and user.user:
        return user.user.id

    return None

# -----------------------------
# Request Model
# -----------------------------
class TextRequest(BaseModel):
    text: str
    mode: str = "simplify"
    level: str = "elementary"
    custom_prompt: str | None = None
    classroom_code: str | None = None
    student_name: str | None = None
    timestamp: str | None = None

# -----------------------------
# Classroom Models
# -----------------------------
class CreateClassroom(BaseModel):
    class_name: str
    allowed_modes: list
    locked_lexile: str | None = None
    allowed_custom: bool = False

class DeleteClassroom(BaseModel):
    code: str

class UpdateClassroom(BaseModel):
    code: str
    allowed_modes: list
    locked_lexile: str | None = None
    allowed_custom: bool = False

# -----------------------------
# Health Check
# -----------------------------
@app.get("/")
def health():
    return {"status": "Backend running"}

# -----------------------------
# Create Classroom
# -----------------------------
@app.post("/create_classroom")
def create_classroom(data: CreateClassroom, authorization: str = Header(None)):
    import random
    import string

    teacher_id = get_teacher_id(authorization)

    code = data.class_name.upper().replace(" ", "")[:5] + "-" + "".join(
        random.choices(string.ascii_uppercase + string.digits, k=4)
    )

    supabase.table("classrooms").insert({
        "class_name": data.class_name,
        "code": code,
        "allowed_modes": data.allowed_modes,
        "locked_lexile": data.locked_lexile,
        "allowed_custom": data.allowed_custom,
        "teacher_id": teacher_id
    }).execute()

    return {"code": code}

# -----------------------------
# Get Classrooms
# -----------------------------
@app.get("/classrooms")
def get_classrooms(authorization: str = Header(None)):
    teacher_id = get_teacher_id(authorization)

    res = supabase.table("classrooms") \
        .select("*") \
        .eq("teacher_id", teacher_id) \
        .execute()

    return res.data

# -----------------------------
# Delete Classroom
# -----------------------------
@app.post("/delete_classroom")
def delete_classroom(data: DeleteClassroom):
    supabase.table("classrooms").delete().eq("code", data.code).execute()
    return {"status": "deleted"}

# -----------------------------
# Update Classroom
# -----------------------------
@app.post("/update_classroom")
def update_classroom(data: UpdateClassroom):
    supabase.table("classrooms").update({
        "allowed_modes": data.allowed_modes,
        "locked_lexile": data.locked_lexile,
        "allowed_custom": data.allowed_custom
    }).eq("code", data.code).execute()

    return {"status": "updated"}

# -----------------------------
# Transform Route
# -----------------------------
@app.post("/transform")
async def transform_text(request: TextRequest):
    try:
        print("\n--- NEW REQUEST ---")
        print("Raw classroom code:", request.classroom_code)
        print("MODE RECEIVED:", request.mode)

        classroom = None
        all_rows = supabase.table("classrooms").select("*").execute()

        if not all_rows.data:
            return {"error": "No rows exist in classrooms table."}

        incoming_code = (request.classroom_code or "").strip().upper()

        match = None
        for row in all_rows.data:
            db_code = (row.get("code") or "").strip().upper()
            if db_code == incoming_code:
                match = row
                break

        if not match:
            return {"error": f"No match found for code: {incoming_code}"}

        classroom = match

        # -----------------------------
        # Governance
        # -----------------------------
        allowed_modes = classroom.get("allowed_modes") or []

        if request.mode not in allowed_modes:
            return {"error": "This mode is not allowed in this classroom."}

        if request.mode == "custom" and not classroom.get("allowed_custom"):
            return {"error": "Custom prompts are not allowed in this classroom."}

        if classroom.get("locked_lexile"):
            request.level = classroom["locked_lexile"]

        # -----------------------------
        # Log Activity
        # -----------------------------
        try:
            if request.classroom_code:
                supabase.table("student_activity").insert({
                    "classroom_code": incoming_code,
                    "student_name": request.student_name or "anonymous",
                    "mode": request.mode,
                    "timestamp": request.timestamp
                }).execute()
        except Exception as log_error:
            print("LOGGING ERROR:", log_error)

        # -----------------------------
        # Prompt Logic
        # -----------------------------
        if request.mode == "custom":
            if not request.custom_prompt:
                return {"error": "No custom prompt provided."}
            system_prompt = request.custom_prompt

        elif request.mode == "simplify":
            lexile_prompts = {
                "early": "Rewrite this text for an early reader at Lexile BR–400L. Use very short sentences, simple vocabulary, and clear ideas.",
                "elementary": "Rewrite this text at a Lexile range of 400L–800L. Use simple vocabulary and shorter sentences while keeping the meaning.",
                "middle": "Rewrite this text at a Lexile range of 800L–1100L. Make it easier to understand for a middle school student while preserving all important ideas.",
                "high": "Rewrite this text at a Lexile range of 1100L–1300L. Keep it clear, academic, and appropriate for high school students.",
                "advanced": "Rewrite this text at a Lexile range of 1300L–1600L. Keep it rigorous, precise, and suitable for advanced readers."
            }
            system_prompt = lexile_prompts.get(
                request.level,
                lexile_prompts["elementary"]
            )

        elif request.mode == "study_guide":
            system_prompt = "Turn this into a structured study guide with headings, key ideas, important terms, and bullet points."

        elif request.mode == "quiz":
            system_prompt = "Create 5 multiple-choice quiz questions based on this text and include an answer key."

        elif request.mode == "vocabulary":
            system_prompt = "Extract 5 important academic vocabulary words from this text and define each clearly."

        elif request.mode == "discussion":
            system_prompt = "Create 5 thoughtful discussion questions based on this text."

        elif request.mode == "cornell":
            system_prompt = "Rewrite this into Cornell Notes format with cues/questions, notes, and a short summary."

        elif request.mode == "summarize":
            system_prompt = "Summarize this text clearly and concisely in a way that keeps the key ideas."

        elif request.mode == "explain":
            system_prompt = "Explain this text in a clearer, easier-to-understand way for a student."

        elif request.mode == "translate":
            system_prompt = "Translate this text into Spanish while preserving the meaning."

        elif request.mode == "read":
            system_prompt = "Rewrite this text clearly for text-to-speech reading while preserving the meaning."

        else:
            system_prompt = "Rewrite this clearly while preserving the original meaning."

        ai_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.text}
            ]
        )

        return {"output": ai_response.choices[0].message.content}

    except Exception as e:
        print("TRANSFORM ERROR:", str(e))
        return {"error": str(e)}

# -----------------------------
# Analytics
# -----------------------------
@app.get("/analytics/{code}")
def get_analytics(code: str, authorization: str = Header(None)):
    try:
        teacher_id = get_teacher_id(authorization)

        if not teacher_id:
            return {"error": "No auth token provided"}

        classroom = supabase.table("classrooms") \
            .select("*") \
            .eq("code", code) \
            .eq("teacher_id", teacher_id) \
            .execute()

        if not classroom.data:
            return {"error": "Unauthorized or classroom not found"}

        activity = supabase.table("student_activity") \
            .select("*") \
            .eq("classroom_code", code) \
            .execute()

        data = activity.data or []

        students = {}
        tool_counts = {}
        student_totals = {}
        total_activity = 0

        for row in data:
            name = row.get("student_name", "anonymous")
            mode = row.get("mode")

            if name not in students:
                students[name] = {}

            if mode not in students[name]:
                students[name][mode] = 0

            students[name][mode] += 1
            total_activity += 1
            tool_counts[mode] = tool_counts.get(mode, 0) + 1
            student_totals[name] = student_totals.get(name, 0) + 1

        most_used_tool = max(tool_counts, key=tool_counts.get) if tool_counts else None
        top_student = max(student_totals, key=student_totals.get) if student_totals else None

        return {
            "classroom_code": code,
            "students": students,
            "total_activity": total_activity,
            "most_used_tool": most_used_tool,
            "top_student": top_student
        }

    except Exception as e:
        print("ANALYTICS ERROR:", str(e))
        return {"error": str(e)}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)
