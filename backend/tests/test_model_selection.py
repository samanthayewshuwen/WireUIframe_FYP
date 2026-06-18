import pytest
from unittest.mock import AsyncMock

from routes.generate_code import ModelSelectionStage
from llm import Llm


class TestModelSelectionAllKeys:

    def setup_method(self):
        mock_throw_error = AsyncMock()
        self.model_selector = ModelSelectionStage(mock_throw_error)

    @pytest.mark.asyncio
    async def test_text_create(self):

        models = await self.model_selector.select_models(
            generation_type="create",
            input_mode="text",
            openai_api_key="key",
            anthropic_api_key="key",
            gemini_api_key="key",
        )

        assert models == [
            Llm.GPT_4O_2024_11_20,
            Llm.CLAUDE_SONNET_4_6,
            Llm.CLAUDE_SONNET_4_6,
            Llm.GPT_4O_2024_11_20,
        ]

    @pytest.mark.asyncio
    async def test_text_update(self):

        models = await self.model_selector.select_models(
            generation_type="update",
            input_mode="text",
            openai_api_key="key",
            anthropic_api_key="key",
            gemini_api_key="key",
        )

        assert models == [
            Llm.GPT_4O_2024_11_20,
            Llm.CLAUDE_SONNET_4_6,
            Llm.CLAUDE_SONNET_4_6,
            Llm.GPT_4O_2024_11_20,
        ]

    @pytest.mark.asyncio
    async def test_image_create(self):

        models = await self.model_selector.select_models(
            generation_type="create",
            input_mode="image",
            openai_api_key="key",
            anthropic_api_key="key",
            gemini_api_key="key",
        )

        assert models == [
            Llm.GPT_4O_2024_11_20,
            Llm.CLAUDE_SONNET_4_6,
            Llm.GEMINI_2_0_FLASH,
            Llm.GPT_4O_2024_11_20,
        ]

    @pytest.mark.asyncio
    async def test_image_update(self):

        models = await self.model_selector.select_models(
            generation_type="update",
            input_mode="image",
            openai_api_key="key",
            anthropic_api_key="key",
            gemini_api_key="key",
        )

        assert models == [
            Llm.GPT_4O_2024_11_20,
            Llm.CLAUDE_SONNET_4_6,
            Llm.CLAUDE_SONNET_4_6,
            Llm.GPT_4O_2024_11_20,
        ]