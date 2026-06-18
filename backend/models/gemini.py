import base64
import time
from typing import Awaitable, Callable, Dict, List, Optional
from openai.types.chat import ChatCompletionMessageParam
from google import genai
from google.genai import types
from llm import Completion, Llm


def extract_image_from_messages(
    messages: List[ChatCompletionMessageParam],
) -> Optional[Dict[str, str]]:
    """
    Extracts image data from the last user message.
    Returns None if no image is found (text-only mode).
    """
    last_msg = messages[-1]
    content = last_msg.get("content", "")  # type: ignore
    if not isinstance(content, list):
        return None

    for part in content:
        if not isinstance(part, dict):
            continue
        if part.get("type") == "image_url":
            image_url = part["image_url"]["url"]  # type: ignore
            if image_url.startswith("data:"):
                mime_type = image_url.split(";")[0].split(":")[1]
                base64_data = image_url.split(",")[1]
                return {"mime_type": mime_type, "data": base64_data}
            else:
                return {"uri": image_url}
    return None  # text-only


def extract_text_from_messages(
    messages: List[ChatCompletionMessageParam],
) -> str:
    """Extract the combined text prompt from all messages."""
    parts: List[str] = []
    for msg in messages:
        content = msg.get("content", "")  # type: ignore
        if isinstance(content, str):
            parts.append(content)
        elif isinstance(content, list):
            for part in content:
                if isinstance(part, dict) and part.get("type") == "text":
                    parts.append(part.get("text", ""))
    return "\n\n".join(p for p in parts if p)


async def stream_gemini_response(
    messages: List[ChatCompletionMessageParam],
    api_key: str,
    callback: Callable[[str], Awaitable[None]],
    model_name: str,
) -> Completion:
    start_time = time.time()

    client = genai.Client(api_key=api_key)
    full_response = ""

    # Build config
    if model_name == Llm.GEMINI_2_5_FLASH_PREVIEW_05_20.value:
        config = types.GenerateContentConfig(
            temperature=0,
            max_output_tokens=20000,
            thinking_config=types.ThinkingConfig(
                thinking_budget=5000, include_thoughts=True
            ),
        )
    else:
        config = types.GenerateContentConfig(
            temperature=0,
            max_output_tokens=8000,
        )

    # Build contents — support both text-only and image+text
    image_data = extract_image_from_messages(messages)
    prompt_text = extract_text_from_messages(messages)

    if image_data and "data" in image_data:
        # Image + text mode
        contents = {
            "parts": [
                {"text": prompt_text},
                types.Part.from_bytes(
                    data=base64.b64decode(image_data["data"]),
                    mime_type=image_data["mime_type"],
                ),
            ]
        }
    else:
        # Text-only mode (no image uploaded)
        contents = {"parts": [{"text": prompt_text}]}

    async for chunk in await client.aio.models.generate_content_stream(
        model=model_name,
        contents=contents,
        config=config,
    ):
        if chunk.candidates and len(chunk.candidates) > 0:
            for part in chunk.candidates[0].content.parts:
                if not part.text:
                    continue
                elif part.thought:
                    print("Gemini thought:", part.text[:80])
                else:
                    full_response += part.text
                    await callback(part.text)

    completion_time = time.time() - start_time
    return {"duration": completion_time, "code": full_response}