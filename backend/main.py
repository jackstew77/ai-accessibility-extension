from fastapi import FastAPI, Header
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

    # 🔥 KEEP YOUR EXISTING
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
        # 🔥 LOG ACTIVITY (UNCHANGED)
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
            system_prompt = request.custom_prompt
        elif request.mode == "simplify":
            system_prompt = "Rewrite at appropriate lexile."
        else:
            system_prompt = "Rewrite clearly."

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

# -----------------------------
# 📊 ANALYTICS (UPGRADED)
# -----------------------------
@app.get("/analytics/{code}")
def get_analytics(code: str, authorization: str = Header(None)):

    teacher_id = get_teacher_id(authorization)

    classroom = supabase.table("classrooms") \
        .select("*") \
        .eq("code", code) \
        .eq("teacher_id", teacher_id) \
        .execute()

    if not classroom.data:
        return {"error": "Unauthorized"}

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

        # 🔥 totals
        total_activity += 1

        if mode not in tool_counts:
            tool_counts[mode] = 0
        tool_counts[mode] += 1

        if name not in student_totals:
            student_totals[name] = 0
        student_totals[name] += 1

    # 🔥 most used tool
    most_used_tool = max(tool_counts, key=tool_counts.get) if tool_counts else None

    # 🔥 top student
    top_student = max(student_totals, key=student_totals.get) if student_totals else None

    return {
        "classroom_code": code,
        "students": students,
        "total_activity": total_activity,
        "most_used_tool": most_used_tool,
        "top_student": top_student
    }
