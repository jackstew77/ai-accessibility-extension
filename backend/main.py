from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
import os

app = FastAPI()

# Allow Chrome extension to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Can restrict later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get API key from environment variable (Render will store it)
client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

# Model for incoming request
class TextRequest(BaseModel):
    text: str

# Test route
@app.get("/")
def home():
    return {"status": "Backend running"}

# Simplify endpoint
@app.post("/simplify")
async def simplify_text(request: TextRequest):
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

    return {"output": response.choices[0].message.content}
