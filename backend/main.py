from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])


# 🔐 HARDCODED CLASSROOM RULES (Phase 2 Test)
HARDCODED_CLASSROOMS = {
    "ENG102-A7X9": {
        "locked_lexile": "middle",  # forces 800–1100L
        "allowed_modes": [
            "simplify",
            "study_guide",
            "quiz",
            "vocabulary"
        ],
        "allow_custom": False
    }
}


class TextRequest(BaseModel):
    text: str
    mode: str = "simplify"
    level: str = "elementary"
    custom_prompt: str | None = None
    classroom_code: str | None = None


@app.get("/")
def home():
    return {"status": "Backend running"}


@app.post("/transform")
async def transform_text(request: TextRequest):
    try:

        # 🔐 APPLY CLASSROOM RULES IF CODE PROVIDED
        if request.classroom_code:
            classroom = HARDCODED_CLASSROOMS.get(request.classroom_code)

            if classroom:

                # Force locked Lexile
                if classroom["locked_lexile"]:
                    request.level = classroom["locked_lexile"]

                # Block disallowed modes
                if request.mode not in classroom["allowed_modes"]:
                    return {"error": "This mode is not allowed in this classroom."}

                # Disable custom prompts if not allowed
                if not classroom["allow_custom"]:
                    request.custom_prompt = None

        # 🔥 CUSTOM PROMPT
        if request.mode == "custom" and request.custom_prompt:
            system_prompt = request.custom_prompt

        # 📚 LEXILE SIMPLIFY
        elif request.mode == "simplify":

            lexile_prompts = {
                "early": "Rewrite this text at a Lexile level between BR and 400L using very simple vocabulary and short sentences.",
                "elementary": "Rewrite this text at a Lexile level between 400L and 800L.",
                "middle": "Rewrite this text at a Lexile level between 800L and 1100L.",
                "high": "Rewrite this text at a Lexile level between 1100L and 1300L.",
                "advanced": "Rewrite this text at a Lexile level between 1300L and 1600L."
            }

            system_prompt = lexile_prompts.get(
                request.level,
                lexile_prompts["elementary"]
            )

        # 🎓 ACADEMIC PRESETS
        elif request.mode == "study_guide":
            system_prompt = "Turn this into a structured study guide with headings and bullet points."

        elif request.mode == "quiz":
            system_prompt = "Create 5 multiple choice quiz questions with an answer key."

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
            system_prompt = "Translate this text into Spanish."

        else:
            system_prompt = "Rewrite clearly."

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.text}
            ]
        )

        return {"output": response.choices[0].message.content}

    except Exception as e:
        return {"error": str(e)}
