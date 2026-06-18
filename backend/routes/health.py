import os
import anthropic
import openai
from dotenv import load_dotenv
from fastapi import APIRouter

load_dotenv()

router = APIRouter()


@router.get("/api/keys/check")
async def check_keys() -> dict:
    results: dict = {}

    # ── Anthropic ────────────────────────────────────────────────────────────
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if anthropic_key:
        try:
            client = anthropic.Anthropic(api_key=anthropic_key)
            client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1,
                messages=[{"role": "user", "content": "hi"}],
            )
            results["anthropic"] = {"status": "ok", "model": "claude-sonnet-4-6"}
        except anthropic.AuthenticationError:
            results["anthropic"] = {"status": "invalid_key"}
        except Exception as e:
            results["anthropic"] = {"status": "error", "detail": str(e)}
    else:
        results["anthropic"] = {"status": "not_configured"}

    # ── OpenAI ───────────────────────────────────────────────────────────────
    openai_key = os.environ.get("OPENAI_API_KEY")
    if openai_key:
        try:
            client = openai.OpenAI(api_key=openai_key)
            client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=1,
                messages=[{"role": "user", "content": "hi"}],
            )
            results["openai"] = {"status": "ok", "model": "gpt-4o"}
        except openai.AuthenticationError:
            results["openai"] = {"status": "invalid_key"}
        except Exception as e:
            results["openai"] = {"status": "error", "detail": str(e)}
    else:
        results["openai"] = {"status": "not_configured"}

    # ── Gemini ───────────────────────────────────────────────────────────────
    gemini_key = os.environ.get("GEMINI_API_KEY")
    results["gemini"] = (
        {"status": "configured"} if gemini_key else {"status": "not_configured"}
    )

    return results
