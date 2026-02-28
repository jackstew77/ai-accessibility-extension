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
    level: str = "5th grade"


@app.get("/")
def home():
    return {"status": "Backend running"}


@app.post("/transform")
async def transform_text(request: TextRequest):
    try:
        if request.mode == "simplify":
            system_prompt = f"Rewrite this text at a {request.level} reading level while preserving meaning."

        elif request.mode == "summarize":
            system_prompt = "Summarize this text clearly and concisely."

        elif request.mode == "explain":
            system_prompt = "Explain this text in very simple terms."

        elif request.mode == "translate":
            system_prompt = "Translate this text into Spanish."

        else:
            system_prompt = "Rewrite the text clearly."

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
