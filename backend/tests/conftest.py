"""
conftest.py — shared fixtures for the WireUI test suite.
Sets MOCK=True so no real API keys are ever needed.
"""
import os
import pytest

os.environ["MOCK"] = "True"
os.environ.setdefault("OPENAI_API_KEY",    "sk-test-placeholder")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-placeholder")
os.environ.setdefault("GEMINI_API_KEY",    "AIza-placeholder")
os.environ.setdefault("SUPABASE_URL",      "https://placeholder.supabase.co")
os.environ.setdefault("SUPABASE_KEY",      "placeholder-key")

@pytest.fixture(scope="session")
def sample_html_doc() -> str:
    return (
        '<html lang="en"><head><title>T</title></head>'
        '<body class="min-h-screen"><h1>Hello</h1></body></html>'
    )

@pytest.fixture(scope="session")
def wireframe_text() -> str:
    return (
        "Dashboard with top nav, sidebar with 5 items, "
        "3 KPI cards, and a line chart below"
    )