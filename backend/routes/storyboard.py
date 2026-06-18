import json
import os
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import anthropic
import openai

from prompts.storyboard_prompts import (
    STORYBOARD_SYSTEM_PROMPT,
    SKETCH_SYSTEM_PROMPT,
    VR_AR_STORYBOARD_SYSTEM_PROMPT,
    VR_GODS_EYE_SKETCH_PROMPT,
    VR_POV_SKETCH_PROMPT,
    VR_REAR_POV_SKETCH_PROMPT,
    VR_AR_OVERLAY_SKETCH_PROMPT,
    STORYBOARD_VALIDATOR_PROMPT,
)

load_dotenv()

router = APIRouter()

# ── Shared LLM helper ────────────────────────────────────────────────────────
# Calls either Anthropic or OpenAI and returns the raw text content.
# model_provider: "anthropic" | "openai"

OPENAI_STORYBOARD_MODEL = "gpt-4o"
OPENAI_VALIDATOR_MODEL = "gpt-4o-mini"


def _resolve_api_key(
    request_key: str | None,
    model_provider: str,
) -> str:
    env_var = "ANTHROPIC_API_KEY" if model_provider == "anthropic" else "OPENAI_API_KEY"
    key = request_key or os.environ.get(env_var)
    if not key:
        raise HTTPException(
            status_code=400,
            detail=f"No {'Anthropic' if model_provider == 'anthropic' else 'OpenAI'} API key provided. "
                   f"Add {env_var} to backend/.env or pass it in the request.",
        )
    return key


ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4-6"
ANTHROPIC_VALIDATOR_MODEL = "claude-haiku-4-5-20251001"


def _call_llm(
    *,
    model_provider: str,
    api_key: str,
    system_prompt: str,
    user_message: str,
    max_tokens: int,
    model: str | None = None,
) -> tuple[str, str | None]:
    if model_provider == "openai":
        client = openai.OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=model or OPENAI_STORYBOARD_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            max_tokens=max_tokens,
            temperature=0,
        )
        text = response.choices[0].message.content or ""
        stop = response.choices[0].finish_reason  # "stop" | "length" | ...
        return text.strip(), stop

    # Default: Anthropic
    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model=model or ANTHROPIC_DEFAULT_MODEL,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )
    return message.content[0].text.strip(), message.stop_reason


class StoryboardRequest(BaseModel):
    scenario: str
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    model_provider: str = "anthropic"       # "anthropic" | "openai"
    storyboard_type: str = "standard"       # "standard" | "vr" | "ar" | "mixed"


@router.post("/api/storyboard")
async def generate_storyboard(request: StoryboardRequest) -> dict:
    api_key = _resolve_api_key(
        request.anthropic_api_key if request.model_provider == "anthropic" else request.openai_api_key,
        request.model_provider,
    )

    is_vr_ar = request.storyboard_type in ("vr", "ar", "mixed")
    system_prompt = VR_AR_STORYBOARD_SYSTEM_PROMPT if is_vr_ar else STORYBOARD_SYSTEM_PROMPT

    type_hint = ""
    if request.storyboard_type == "vr":
        type_hint = " This is a VR (Virtual Reality) game. Use gods_eye and player_pov view types. Include spatial audio, haptics, trigger points, FOV zones, and branching paths."
    elif request.storyboard_type == "ar":
        type_hint = " This is an AR (Augmented Reality) game. Use ar_overlay view types predominantly, with real-world integration, spatial anchors, and occlusion details."
    elif request.storyboard_type == "mixed":
        type_hint = " This is a Mixed Reality experience. Mix all three view types (gods_eye, player_pov, ar_overlay) as appropriate."

    max_tokens = 6000 if is_vr_ar else 3000
    user_message = f"Generate a {'VR/AR spatial' if is_vr_ar else 'gameplay'} storyboard for this scenario:\n\n{request.scenario}{type_hint}"

    try:
        raw, stop_reason = _call_llm(
            model_provider=request.model_provider,
            api_key=api_key,
            system_prompt=system_prompt,
            user_message=user_message,
            max_tokens=max_tokens,
        )

        # Detect truncation before attempting parse
        if stop_reason in ("max_tokens", "length"):
            raise HTTPException(
                status_code=500,
                detail="Response was cut off (too long). Try requesting fewer scenes or a shorter scenario.",
            )

        # Strip markdown fences if the model wraps the JSON anyway
        if raw.startswith("```"):
            lines = raw.splitlines()
            raw = "\n".join(
                line for line in lines if not line.startswith("```")
            ).strip()

        storyboard = json.loads(raw)

        if "storyboard_type" not in storyboard:
            storyboard["storyboard_type"] = request.storyboard_type

        return storyboard

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Model returned invalid JSON: {str(e)}")
    except (anthropic.AuthenticationError, openai.AuthenticationError):
        raise HTTPException(status_code=401, detail="Invalid API key.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Storyboard generation failed: {str(e)}")


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
    openai_api_key: str | None = None
    model_provider: str = "anthropic"
    # VR/AR-specific fields
    view_type: str = "standard"  # "standard" | "gods_eye" | "player_pov" | "ar_overlay"
    fov_zone: str | None = None
    trigger: str | None = None
    audio_spatial: str | None = None
    haptics: str | None = None
    transition: str | None = None
    branching_paths: list[str] = []


def _select_sketch_prompt(view_type: str) -> str:
    if view_type == "gods_eye":
        return VR_GODS_EYE_SKETCH_PROMPT
    if view_type == "player_pov":
        return VR_POV_SKETCH_PROMPT
    if view_type == "rear_pov":
        return VR_REAR_POV_SKETCH_PROMPT
    if view_type == "ar_overlay":
        return VR_AR_OVERLAY_SKETCH_PROMPT
    return SKETCH_SYSTEM_PROMPT


@router.post("/api/storyboard/sketch")
async def generate_sketch(request: SketchRequest) -> dict:
    api_key = _resolve_api_key(
        request.anthropic_api_key if request.model_provider == "anthropic" else request.openai_api_key,
        request.model_provider,
    )

    elements_str = ", ".join(request.elements) if request.elements else "none"
    user_message = (
        f"Scene title: {request.title}\n"
        f"Environment: {request.environment}\n"
        f"Player position: {request.player_position}\n"
        f"Player action: {request.player_action}\n"
        f"Key elements: {elements_str}\n"
        f"Outcome: {request.outcome}\n"
        f"Description: {request.description}\n"
        f"Scene ID (use for activity number): {request.scene_id}"
    )

    # Append VR/AR-specific context when present
    if request.view_type != "standard":
        vr_context_parts = [f"View type: {request.view_type}"]
        if request.fov_zone:
            vr_context_parts.append(f"FOV zone: {request.fov_zone}")
        if request.trigger:
            vr_context_parts.append(f"Trigger: {request.trigger}")
        if request.audio_spatial:
            vr_context_parts.append(f"Spatial audio: {request.audio_spatial}")
        if request.haptics:
            vr_context_parts.append(f"Haptics: {request.haptics}")
        if request.transition:
            vr_context_parts.append(f"Transition: {request.transition}")
        if request.branching_paths:
            vr_context_parts.append(f"Branching paths: {' | '.join(request.branching_paths)}")
        user_message += "\n" + "\n".join(vr_context_parts)

    system_prompt = _select_sketch_prompt(request.view_type)
    sketch_max_tokens = 4000 if request.view_type != "standard" else 2048

    try:
        raw, _ = _call_llm(
            model_provider=request.model_provider,
            api_key=api_key,
            system_prompt=system_prompt,
            user_message=f"Generate an animated SVG sketch for this scene:\n\n{user_message}",
            max_tokens=sketch_max_tokens,
        )

        # Strip markdown fences if present
        if raw.startswith("```"):
            lines = raw.splitlines()
            raw = "\n".join(line for line in lines if not line.startswith("```")).strip()

        if not raw.startswith("<svg"):
            raise ValueError(f"Unexpected response format (expected SVG, got: {raw[:80]}...)")

        return {"svg": raw, "view_type": request.view_type}

    except (anthropic.AuthenticationError, openai.AuthenticationError):
        raise HTTPException(status_code=401, detail="Invalid API key.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sketch generation failed: {str(e)}")


class ValidationRequest(BaseModel):
    storyboard: dict                    # the generated storyboard JSON
    original_prompt: str                # the compiled prompt sent to Claude
    requirements: dict | None = None   # structured requirements from the wizard
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    model_provider: str = "anthropic"
    # validator_provider controls which LLM performs cross-validation.
    # "openai" = GPT-4o-mini validates Claude output (recommended cross-validator).
    # "anthropic" = Claude Haiku validates (fallback when no OpenAI key).
    validator_provider: str = "openai"


def _build_validator_message(
    storyboard: dict,
    original_prompt: str,
    requirements: dict | None,
) -> str:
    storyboard_json = json.dumps(storyboard, indent=2)
    msg = (
        f"USER REQUIREMENTS (original prompt sent to the generation model):\n{original_prompt}\n\n"
        f"GENERATED STORYBOARD JSON:\n{storyboard_json}"
    )
    if requirements:
        parts: list[str] = []
        if requirements.get("sceneCount"):
            parts.append(f"Expected scene count: {requirements['sceneCount']}")
        if requirements.get("viewTypePattern"):
            parts.append(f"View type pattern: {requirements['viewTypePattern']}")
        if requirements.get("triggerTypes"):
            parts.append(f"Required trigger types: {', '.join(requirements['triggerTypes'])}")
        if requirements.get("sensoryFeatures"):
            parts.append(f"Required sensory features: {', '.join(requirements['sensoryFeatures'])}")
        if requirements.get("fovCoverage"):
            parts.append(f"FOV coverage: {requirements['fovCoverage']}")
        if parts:
            msg += "\n\nSTRUCTURED REQUIREMENTS SUMMARY:\n" + "\n".join(parts)
    return msg


@router.post("/api/storyboard/validate")
async def validate_storyboard(request: ValidationRequest) -> dict:
    # Resolve validator API key.
    # Prefer OpenAI (cross-validation) when validator_provider == "openai".
    # Fall back to Anthropic Haiku if OpenAI key is unavailable.
    use_openai = request.validator_provider == "openai"
    if use_openai:
        openai_key = request.openai_api_key or os.environ.get("OPENAI_API_KEY")
        if not openai_key:
            # silently fall back to Anthropic Haiku
            use_openai = False

    if use_openai:
        validator_model_provider = "openai"
        validator_api_key = openai_key  # type: ignore[possibly-undefined]
        validator_model = OPENAI_VALIDATOR_MODEL   # gpt-4o-mini
    else:
        validator_model_provider = "anthropic"
        validator_api_key = request.anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY")
        validator_model = ANTHROPIC_VALIDATOR_MODEL  # claude-haiku
        if not validator_api_key:
            raise HTTPException(status_code=400, detail="No API key available for validation.")

    user_message = _build_validator_message(
        request.storyboard, request.original_prompt, request.requirements
    )

    # Validator needs more tokens now that it also writes improved_prompt
    validator_max_tokens = 2048

    try:
        raw, _ = _call_llm(
            model_provider=validator_model_provider,
            api_key=validator_api_key,
            system_prompt=STORYBOARD_VALIDATOR_PROMPT,
            user_message=user_message,
            max_tokens=validator_max_tokens,
            model=validator_model,
        )

        if raw.startswith("```"):
            lines = raw.splitlines()
            raw = "\n".join(line for line in lines if not line.startswith("```")).strip()

        result = json.loads(raw)
        # Surface which provider ran validation so the UI can label it
        result["validator_provider"] = validator_model_provider
        result["validator_model"] = validator_model
        return result

    except json.JSONDecodeError as e:
        return {
            "valid": True,
            "score": 1.0,
            "scene_count_ok": True,
            "issues": [],
            "warnings": [f"Validator returned unstructured output: {str(e)}"],
            "passed_checks": ["Generation completed successfully"],
            "improved_prompt": None,
            "improvements": [],
            "validator_provider": validator_model_provider,
            "validator_model": validator_model,
        }
    except (anthropic.AuthenticationError, openai.AuthenticationError):
        raise HTTPException(status_code=401, detail="Invalid API key for validator.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")
