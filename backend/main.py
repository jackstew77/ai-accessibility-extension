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


class TextRequest(BaseModel):
    text: str
    mode: str = "simplify"
    level: str = "elementary"
    custom_prompt: str | None = None


@app.get("/")
def home():
    return {"status": "Backend running"}


@app.post("/transform")
async def transform_text(request: TextRequest):
    try:

        # 🔥 CUSTOM PROMPT MODE
        if request.mode == "custom" and request.custom_prompt:
            system_prompt = request.custom_prompt

        # 📚 SIMPLIFY WITH LEXILE BANDS
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

        # 📝 OTHER MODES
        elif request.mode == "summarize":
            system_prompt = "Summarize this text clearly and concisely for students."

        elif request.mode == "explain":
            system_prompt = "Explain this text in clear, student-friendly language."

        elif request.mode == "translate":
            system_prompt = "Translate this text into Spanish."

        else:
            system_prompt = "Rewrite this text clearly."

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
