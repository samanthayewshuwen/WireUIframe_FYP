from typing import Union, Any, cast
from openai.types.chat import ChatCompletionMessageParam, ChatCompletionContentPartParam

from custom_types import InputMode
from image_generation.core import create_alt_url_mapping
from prompts.imported_code_prompts import IMPORTED_CODE_SYSTEM_PROMPTS
from prompts.screenshot_system_prompts import SYSTEM_PROMPTS
from prompts.text_prompts import SYSTEM_PROMPTS as TEXT_SYSTEM_PROMPTS, WIREFRAME_SYSTEM_PROMPT
from prompts.types import Stack, PromptContent
from video.utils import assemble_claude_prompt_video


USER_PROMPT = """
Generate code for a web page that looks exactly like this.
"""

SVG_USER_PROMPT = """
Generate code for a SVG that looks exactly like this.
"""


def _history_item_text(item: Any) -> str:
    """
    Extract the text/content payload from a history item, tolerating the
    different shapes producers may send:
      - {"text": "...", "images": [...]}   (legacy / image-aware shape)
      - {"type": "code" | "text", "value": "..."}  (granular-editing shape)
      - a plain string
    Falls back to an empty string rather than raising if neither key is present,
    so a single malformed/older history item can't take down the whole prompt
    assembly step.
    """
    if isinstance(item, str):
        return item
    if isinstance(item, dict):
        if "text" in item:
            return item["text"]
        if "value" in item:
            return item["value"]
    return ""


def _history_item_images(item: Any) -> list[str]:
    """Extract any images attached to a history item, if present."""
    if isinstance(item, dict):
        images = item.get("images")
        if images:
            return images
    return []


async def create_prompt(
    stack: Stack,
    input_mode: InputMode,
    generation_type: str,
    prompt: PromptContent,
    history: list[dict[str, Any]],
    is_imported_from_code: bool,
    aesthetic_mode: str = "high_fi",
) -> tuple[list[ChatCompletionMessageParam], dict[str, str]]:

    image_cache: dict[str, str] = {}

    # If this generation started off with imported code, we need to assemble the prompt differently
    if is_imported_from_code:
        original_imported_code = (
            _history_item_text(history[0]) if history else prompt.get("text", "")
        )
        prompt_messages = assemble_imported_code_prompt(original_imported_code, stack)
        for index, item in enumerate(history[1:]):
            role = "user" if index % 2 == 0 else "assistant"
            message = create_message_from_history_item(item, role)
            prompt_messages.append(message)
    else:
        # Assemble the prompt for non-imported code
        if input_mode == "image":
            image_url = prompt["images"][0]
            prompt_messages = assemble_prompt(image_url, stack)
        elif input_mode == "text":
            prompt_messages = assemble_text_prompt(prompt["text"], stack, aesthetic_mode)
        else:
            # Default to image mode for backward compatibility
            image_url = prompt["images"][0]
            prompt_messages = assemble_prompt(image_url, stack)

        if generation_type == "update":
            # Transform the history tree into message format
            for index, item in enumerate(history):
                role = "assistant" if index % 2 == 0 else "user"
                message = create_message_from_history_item(item, role)
                prompt_messages.append(message)

            if len(history) >= 2:
                image_cache = create_alt_url_mapping(_history_item_text(history[-2]))

    if input_mode == "video":
        video_data_url = prompt["images"][0]
        prompt_messages = await assemble_claude_prompt_video(video_data_url)

    return prompt_messages, image_cache


def create_message_from_history_item(
    item: dict[str, Any], role: str
) -> ChatCompletionMessageParam:
    """
    Create a ChatCompletionMessageParam from a history item.
    Handles both text-only and text+images content, and tolerates history
    items shaped as either {"text": ..., "images": [...]} or
    {"type": ..., "value": ...}.
    """
    item_text = _history_item_text(item)
    item_images = _history_item_images(item)

    # Check if this is a user message with images
    if role == "user" and item_images:
        # Create multipart content for user messages with images
        user_content: list[ChatCompletionContentPartParam] = []

        # Add all images first
        for image_url in item_images:
            user_content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": image_url, "detail": "high"},
                }
            )

        # Add text content
        user_content.append(
            {
                "type": "text",
                "text": item_text,
            }
        )

        return cast(
            ChatCompletionMessageParam,
            {
                "role": role,
                "content": user_content,
            },
        )
    else:
        # Regular text-only message
        return cast(
            ChatCompletionMessageParam,
            {
                "role": role,
                "content": item_text,
            },
        )


def assemble_imported_code_prompt(
    code: str, stack: Stack
) -> list[ChatCompletionMessageParam]:
    system_content = IMPORTED_CODE_SYSTEM_PROMPTS[stack]

    user_content = (
        "Here is the code of the app: " + code
        if stack != "svg"
        else "Here is the code of the SVG: " + code
    )

    return [
        {
            "role": "system",
            "content": system_content + "\n " + user_content,
        }
    ]


def assemble_prompt(
    image_data_url: str,
    stack: Stack,
) -> list[ChatCompletionMessageParam]:
    system_content = SYSTEM_PROMPTS[stack]
    user_prompt = USER_PROMPT if stack != "svg" else SVG_USER_PROMPT

    user_content: list[ChatCompletionContentPartParam] = [
        {
            "type": "image_url",
            "image_url": {"url": image_data_url, "detail": "high"},
        },
        {
            "type": "text",
            "text": user_prompt,
        },
    ]
    return [
        {
            "role": "system",
            "content": system_content,
        },
        {
            "role": "user",
            "content": user_content,
        },
    ]


def assemble_text_prompt(
    text_prompt: str,
    stack: Stack,
    aesthetic_mode: str = "high_fi",
) -> list[ChatCompletionMessageParam]:

    system_content = WIREFRAME_SYSTEM_PROMPT if aesthetic_mode == "wireframe" else TEXT_SYSTEM_PROMPTS[stack]

    return [
        {
            "role": "system",
            "content": system_content,
        },
        {
            "role": "user",
            "content": "Generate UI for " + text_prompt,
        },
    ]