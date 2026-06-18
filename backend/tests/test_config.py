"""
Tests for config.py
Module: User Management / Security (NFR-01-001)
Covers: Config reads from environment and sets safe defaults.
"""

import importlib
import os
import pytest


def reload_config(env_overrides: dict) -> object:
    """Helper: patch env vars then reload the config module."""
    old_env = {k: os.environ.get(k) for k in env_overrides}
    os.environ.update({k: v for k, v in env_overrides.items() if v is not None})
    for k, v in env_overrides.items():
        if v is None:
            os.environ.pop(k, None)
    import config
    importlib.reload(config)
    # restore
    for k, v in old_env.items():
        if v is None:
            os.environ.pop(k, None)
        else:
            os.environ[k] = v
    return config


class TestConfigDefaults:
    """Without any env vars set, config should expose safe defaults."""

    def test_num_variants_is_4(self):
        import config
        assert config.NUM_VARIANTS == 4

    def test_mock_defaults_to_false(self):
        cfg = reload_config({"MOCK": None})
        assert cfg.SHOULD_MOCK_AI_RESPONSE is False

    def test_debug_defaults_to_false(self):
        cfg = reload_config({"IS_DEBUG_ENABLED": None})
        assert cfg.IS_DEBUG_ENABLED is False

    def test_is_prod_defaults_to_falsy(self):
        cfg = reload_config({"IS_PROD": None})
        assert not cfg.IS_PROD

    def test_api_keys_default_to_none(self):
        cfg = reload_config({
            "OPENAI_API_KEY": None,
            "ANTHROPIC_API_KEY": None,
            "GEMINI_API_KEY": None,
            "REPLICATE_API_KEY": None,
        })
        assert cfg.OPENAI_API_KEY is None
        assert cfg.ANTHROPIC_API_KEY is None
        assert cfg.GEMINI_API_KEY is None
        assert cfg.REPLICATE_API_KEY is None


class TestConfigFromEnv:
    """Config values must reflect what is set in the environment."""

    def test_openai_key_read_from_env(self):
        cfg = reload_config({"OPENAI_API_KEY": "sk-test-openai"})
        assert cfg.OPENAI_API_KEY == "sk-test-openai"

    def test_anthropic_key_read_from_env(self):
        cfg = reload_config({"ANTHROPIC_API_KEY": "sk-ant-test"})
        assert cfg.ANTHROPIC_API_KEY == "sk-ant-test"

    def test_gemini_key_read_from_env(self):
        cfg = reload_config({"GEMINI_API_KEY": "AIza-test"})
        assert cfg.GEMINI_API_KEY == "AIza-test"

    def test_mock_enabled_from_env(self):
        cfg = reload_config({"MOCK": "True"})
        # Any truthy env string makes SHOULD_MOCK_AI_RESPONSE truthy
        assert cfg.SHOULD_MOCK_AI_RESPONSE

    def test_is_prod_set_from_env(self):
        cfg = reload_config({"IS_PROD": "1"})
        assert cfg.IS_PROD

    def test_openai_base_url_from_env(self):
        cfg = reload_config({"OPENAI_BASE_URL": "https://my-proxy.example.com"})
        assert cfg.OPENAI_BASE_URL == "https://my-proxy.example.com"