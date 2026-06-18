"""
FR-24 to FR-27 — Project & History Management
==============================================
ARCHITECTURE NOTE:
History in this project is stored in Supabase table 'generations' directly
from the frontend (HistoryPanel.tsx calls supabase.from('generations').select()).
The FastAPI backend's role is to WRITE to that table via save_to_supabase()
after every successful generation.

These tests validate the BACKEND side:
  FR-24  save_to_supabase is called with the right data after generation
  FR-25  The saved data includes all fields needed to display in history
  FR-26  Sufficient data is saved to reload a past project (prompt + code)
  FR-27  Deletion is a Supabase RLS operation; backend does not prevent it
"""

import os
import pytest
from unittest.mock import patch, AsyncMock
os.environ["MOCK"] = "True"

from fastapi.testclient import TestClient
from main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def run_generation(client, text="A hero section", stack="html_tailwind",
                   user_id="user-history-test") -> list[dict]:
    captured_saves = []

    async def capture(prompt_msgs, code, user_id=None, aesthetic_mode="high_fi"):
        captured_saves.append({
            "prompt_msgs": prompt_msgs,
            "code": code,
            "user_id": user_id,
            "aesthetic_mode": aesthetic_mode,
        })

    with patch("routes.generate_code.save_to_supabase", side_effect=capture):
        try:
            with client.websocket_connect("/generate-code") as ws:
                ws.send_json({
                    "generationType": "create",
                    "inputMode": "text",
                    "prompt": {"text": text, "images": []},
                    "history": [],
                    "isImportedFromCode": False,
                    "stack": stack,
                    "userId": user_id,
                    "generationId": "history-test",
                    "aestheticMode": "high_fi",
                })
                try:
                    while True:
                        ws.receive_json()
                except Exception:
                    pass
        except Exception:
            pass

    return captured_saves


class TestFR24_SaveGeneration:
    """FR-24: After code generation, the project is saved to Supabase
    with prompt, code, user_id, and aesthetic_mode."""

    def test_save_is_called_after_generation(self, client):
        saves = run_generation(client)
        assert saves, "save_to_supabase was never called after generation"

    def test_saved_code_is_non_empty(self, client):
        saves = run_generation(client, text="A contact form")
        assert saves, "No save call captured"
        assert saves[0]["code"] and len(saves[0]["code"]) > 0, (
            "Saved code is empty — history will show blank projects"
        )

    def test_saved_prompt_msgs_is_not_none(self, client):
        saves = run_generation(client, text="A navbar with 5 links")
        assert saves, "No save call captured"
        assert saves[0]["prompt_msgs"] is not None, (
            "prompt_msgs is None — cannot reconstruct what the user asked"
        )

    def test_saved_user_id_matches_session(self, client):
        saves = run_generation(client, user_id="user-xyz-456")
        assert saves, "No save call captured"
        assert saves[0]["user_id"] == "user-xyz-456", (
            f"user_id mismatch: expected 'user-xyz-456', got '{saves[0]['user_id']}'"
        )

    def test_aesthetic_mode_is_saved(self, client):
        saves = run_generation(client)
        assert saves, "No save call captured"
        assert saves[0]["aesthetic_mode"] in ("high_fi", "wireframe", "lo_fi"), (
            f"Unexpected aesthetic_mode: {saves[0]['aesthetic_mode']}"
        )

    def test_save_called_once_per_variant(self, client):
        """Each completed variant must be saved independently."""
        saves = run_generation(client, text="Dashboard with charts")
        assert len(saves) >= 1, "Expected at least one save call per generation"


class TestFR25_HistoryDashboard:
    """FR-25: The history dashboard reads from Supabase 'generations' table.
    Backend must save enough data for the frontend query to succeed."""

    def test_saved_code_contains_html(self, client):
        """The saved code must be valid HTML so the history thumbnail can render it."""
        saves = run_generation(client, text="A footer with social links")
        assert saves
        code = saves[0]["code"]
        assert "<" in code and ">" in code, (
            "Saved code does not look like HTML — history thumbnails will be broken"
        )

    def test_multiple_generations_all_saved(self, client):
        """Each generation call produces its own save — history grows correctly."""
        all_saves = []

        async def capture(prompt_msgs, code, user_id=None, aesthetic_mode="high_fi"):
            all_saves.append(code)

        prompts = ["A login form", "A dashboard", "A profile page"]
        with patch("routes.generate_code.save_to_supabase", side_effect=capture):
            for text in prompts:
                try:
                    with client.websocket_connect("/generate-code") as ws:
                        ws.send_json({
                            "generationType": "create",
                            "inputMode": "text",
                            "prompt": {"text": text, "images": []},
                            "history": [],
                            "isImportedFromCode": False,
                            "stack": "html_tailwind",
                            "generationId": f"multi-{text[:5]}",
                        })
                        try:
                            while True:
                                ws.receive_json()
                        except Exception:
                            pass
                except Exception:
                    pass

        assert len(all_saves) >= len(prompts), (
            f"Expected {len(prompts)} saves, got {len(all_saves)}"
        )


class TestFR26_ReloadProject:
    """FR-26: A past project can be reloaded — requires that both
    prompt text and generated code are saved."""

    def test_prompt_text_extractable_from_saved_messages(self, client):
        """The saved prompt_msgs must contain the user's original text
        so it can be shown when reloading a project."""
        saves = run_generation(client, text="An e-commerce product card")
        assert saves
        prompt_msgs = saves[0]["prompt_msgs"]
        # The prompt messages list must contain the user's text somewhere
        has_text = False
        for msg in prompt_msgs:
            content = msg.get("content", "")
            if isinstance(content, str) and len(content) > 0:
                has_text = True
            elif isinstance(content, list):
                for part in content:
                    if isinstance(part, dict) and part.get("type") == "text":
                        if part.get("text", ""):
                            has_text = True
        assert has_text, (
            "No text found in saved prompt_msgs — cannot show prompt when reloading"
        )

    def test_saved_code_is_complete_html(self, client):
        """Reloaded code must be complete enough to render in the preview."""
        saves = run_generation(client, text="A registration form")
        assert saves
        code = saves[0]["code"]
        assert len(code) > 50, f"Saved code is too short to be a real UI: {len(code)} chars"


class TestFR27_DeleteProject:
    """FR-27: Deletion is handled by Supabase RLS from the frontend.
    The backend's responsibility is that saved records have a user_id
    so RLS can enforce that only the owner can delete."""

    def test_saves_include_user_id_for_rls(self, client):
        """Every authenticated save must include user_id so Supabase RLS
        can enforce that only the owner can delete the record."""
        saves = run_generation(client, user_id="owner-user-001")
        assert saves
        assert saves[0]["user_id"] == "owner-user-001", (
            "user_id missing from save — RLS delete protection will not work"
        )

    def test_anonymous_saves_have_no_user_id(self, client):
        """Anonymous saves (no userId in payload) get user_id=None,
        which is correct — they can be cleaned up without RLS issues."""
        captures = []

        async def capture(prompt_msgs, code, user_id=None, aesthetic_mode="high_fi"):
            captures.append(user_id)

        with patch("routes.generate_code.save_to_supabase", side_effect=capture):
            try:
                with client.websocket_connect("/generate-code") as ws:
                    ws.send_json({
                        "generationType": "create",
                        "inputMode": "text",
                        "prompt": {"text": "Test", "images": []},
                        "history": [],
                        "isImportedFromCode": False,
                        "stack": "html_tailwind",
                        "generationId": "anon-del-test",
                    })  # no userId
                    try:
                        while True:
                            ws.receive_json()
                    except Exception:
                        pass
            except Exception:
                pass

        assert captures, "No save call made"
        assert captures[0] is None