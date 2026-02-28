from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
import os

app = FastAPI()

# Allow Chrome extension to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client using Render environment variable
client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])


# Request model
class TextRequest(BaseModel):
    text: str
    mode: str = "simplify"


# Health check route
@app.get("/")
def home():
    return {"status": "Backend running"}


# Main AI transformation endpoint
@app.post("/transform")
async def transform_text(request: TextRequest):
    try:
        prompts = {
            "simplify": "Rewrite the text at a 5th grade reading level while preserving meaning.",
            "summarize": "Summarize this text clearly and concisely.",
            "explain": "Explain this text in very simple terms.",
            "translate": "Translate this text into Spanish."
        }

        # Default to simplify if mode not recognized
        system_prompt = prompts.get(request.mode, prompts["simplify"])

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.text}
            ]
        )

        output_text = response.choices[0].message.content

        return {"output": output_text}

    except Exception as e:
        return {"error": str(e)}
