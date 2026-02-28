from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
import os

app = FastAPI()

# Allow Chrome extension to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load API key from Render environment variable
client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])


# Request model
class TextRequest(BaseModel):
    text: str


# Root route (for testing)
@app.get("/")
def home():
    return {"status": "Backend running"}


# Simplify endpoint
@app.post("/simplify")
async def simplify_text(request: TextRequest):
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are an accessibility assistant. Rewrite the text at a 5th grade reading level while preserving meaning."
                },
                {
                    "role": "user",
                    "content": request.text
                }
            ]
        )

        simplified_text = response.choices[0].message.content

        return {"output": simplified_text}

    except Exception as e:
        return {"error": str(e)}
