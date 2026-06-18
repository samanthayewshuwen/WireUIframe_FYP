import json
import os
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import anthropic

from prompts.storyboard_prompts import STORYBOARD_SYSTEM_PROMPT, SKETCH_SYSTEM_PROMPT

load_dotenv()

router = APIRouter()


class StoryboardRequest(BaseModel):
    scenario: str
    anthropic_api_key: str | None = None


@router.post("/api/storyboard")
async def generate_storyboard(request: StoryboardRequest) -> dict:
    api_key = request.anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No Anthropic API key provided. Add ANTHROPIC_API_KEY to backend/.env or pass it in the request.",
        )

    client = anthropic.Anthropic(api_key=api_key)

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            system=STORYBOARD_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Generate a gameplay storyboard for this game scenario:\n\n{request.scenario}",
                }
            ],
        )

        raw = message.content[0].text.strip()

        # Strip markdown fences if Claude wraps the JSON anyway
        if raw.startswith("```"):
            lines = raw.splitlines()
            raw = "\n".join(
                line for line in lines if not line.startswith("```")
            ).strip()

        storyboard = json.loads(raw)
        return storyboard

    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Claude returned invalid JSON: {str(e)}",
        )
    except anthropic.AuthenticationError:
        raise HTTPException(
            status_code=401,
            detail="Invalid Anthropic API key.",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Storyboard generation failed: {str(e)}",
        )


class SketchRequest(BaseModel):
    scene_id: int
    title: str
    environment: str
    player_position: str
    player_action: str
    elements: list[str]
    outcome: str
    description: str
    anthropic_api_key: str | None = None


@router.post("/api/storyboard/sketch")
async def generate_sketch(request: SketchRequest) -> dict:
    api_key = request.anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No Anthropic API key provided.",
        )

    elements_str = ", ".join(request.elements) if request.elements else "none"
    user_message = (
        f"Scene title: {request.title}\n"
        f"Environment: {request.environment}\n"
        f"Player position: {request.player_position}\n"
        f"Player action: {request.player_action}\n"
        f"Key elements: {elements_str}\n"
        f"Outcome: {request.outcome}\n"
        f"Description: {request.description}"
    )

    client = anthropic.Anthropic(api_key=api_key)

    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
            system=SKETCH_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Generate an animated SVG sketch for this gameplay scene:\n\n{user_message}",
                }
            ],
        )

        raw = message.content[0].text.strip()

        # Strip markdown fences if present
        if raw.startswith("```"):
            lines = raw.splitlines()
            raw = "\n".join(
                line for line in lines if not line.startswith("```")
            ).strip()

        if not raw.startswith("<svg"):
            raise ValueError(f"Unexpected response format (expected SVG, got: {raw[:80]}...)")

        return {"svg": raw}

    except anthropic.AuthenticationError:
        raise HTTPException(status_code=401, detail="Invalid Anthropic API key.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sketch generation failed: {str(e)}")
