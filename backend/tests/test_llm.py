"""
Tests for llm.py
Module: Agentic Schema-First Generation / AI Validator Agent
Covers: Model enum integrity, provider mapping completeness,
        and convenience sets (OPENAI_MODELS, ANTHROPIC_MODELS, GEMINI_MODELS)
"""

import pytest
from llm import (
    Llm,
    MODEL_PROVIDER,
    OPENAI_MODELS,
    ANTHROPIC_MODELS,
    GEMINI_MODELS,
    Completion,
)


class TestLlmEnum:
    """Every entry in the Llm enum must have a non-empty string value."""

    def test_all_enum_values_are_non_empty_strings(self):
        for model in Llm:
            assert isinstance(model.value, str), f"{model.name} value is not a string"
            assert model.value.strip(), f"{model.name} value is empty"

    def test_known_anthropic_model_present(self):
        assert Llm.CLAUDE_SONNET_4_6 in Llm

    def test_known_openai_model_present(self):
        assert Llm.GPT_4O_2024_11_20 in Llm

    def test_known_gemini_model_present(self):
        assert Llm.GEMINI_2_5_FLASH_PREVIEW_05_20 in Llm


class TestModelProviderMapping:
    """MODEL_PROVIDER must be complete and consistent."""

    def test_every_enum_member_is_mapped(self):
        unmapped = [m for m in Llm if m not in MODEL_PROVIDER]
        assert not unmapped, f"Unmapped models: {unmapped}"

    def test_provider_values_are_valid_strings(self):
        valid_providers = {"openai", "anthropic", "gemini"}
        for model, provider in MODEL_PROVIDER.items():
            assert provider in valid_providers, (
                f"{model.name} has unknown provider '{provider}'"
            )

    def test_no_extra_keys_beyond_enum(self):
        """MODEL_PROVIDER should not reference models outside the enum."""
        enum_set = set(Llm)
        for key in MODEL_PROVIDER:
            assert key in enum_set, f"Unknown key in MODEL_PROVIDER: {key}"


class TestConvenienceSets:
    """OPENAI_MODELS / ANTHROPIC_MODELS / GEMINI_MODELS must be consistent
    with MODEL_PROVIDER."""

    def test_openai_models_match_provider_map(self):
        expected = {m for m, p in MODEL_PROVIDER.items() if p == "openai"}
        assert OPENAI_MODELS == expected

    def test_anthropic_models_match_provider_map(self):
        expected = {m for m, p in MODEL_PROVIDER.items() if p == "anthropic"}
        assert ANTHROPIC_MODELS == expected

    def test_gemini_models_match_provider_map(self):
        expected = {m for m, p in MODEL_PROVIDER.items() if p == "gemini"}
        assert GEMINI_MODELS == expected

    def test_sets_are_disjoint(self):
        assert not (OPENAI_MODELS & ANTHROPIC_MODELS), "OpenAI/Anthropic overlap"
        assert not (OPENAI_MODELS & GEMINI_MODELS), "OpenAI/Gemini overlap"
        assert not (ANTHROPIC_MODELS & GEMINI_MODELS), "Anthropic/Gemini overlap"

    def test_union_covers_all_models(self):
        all_from_sets = OPENAI_MODELS | ANTHROPIC_MODELS | GEMINI_MODELS
        all_from_enum = set(Llm)
        assert all_from_sets == all_from_enum

    def test_each_set_non_empty(self):
        assert len(OPENAI_MODELS) > 0
        assert len(ANTHROPIC_MODELS) > 0
        assert len(GEMINI_MODELS) > 0

    # ── Spot-checks for specific models ─────────────────────────────────

    def test_claude_sonnet_4_6_in_anthropic(self):
        assert Llm.CLAUDE_SONNET_4_6 in ANTHROPIC_MODELS

    def test_gpt4o_in_openai(self):
        assert Llm.GPT_4O_2024_11_20 in OPENAI_MODELS

    def test_gemini_flash_in_gemini(self):
        assert Llm.GEMINI_2_0_FLASH in GEMINI_MODELS

    def test_claude_not_in_openai(self):
        assert Llm.CLAUDE_SONNET_4_6 not in OPENAI_MODELS

    def test_gpt_not_in_anthropic(self):
        assert Llm.GPT_4O_2024_11_20 not in ANTHROPIC_MODELS