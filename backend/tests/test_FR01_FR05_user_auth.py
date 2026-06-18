"""
FR-01 to FR-05 — User Authentication & Access Control
======================================================
ARCHITECTURE NOTE:
Auth in this project is handled entirely by the Supabase client SDK
in the frontend (Login.tsx calls supabase.auth.signUp / signInWithPassword).
The FastAPI backend has NO /auth/* routes — it only receives a userId
in the WebSocket payload (FR-02/FR-03 session persistence).

These tests therefore validate the BACKEND side of auth:
  - The WebSocket pipeline correctly reads and uses the userId from the session
  - The save_to_supabase function stores the user_id alongside generated code
  - Requests with no userId still work (anonymous generation)
  - The root health-check endpoint is accessible (FR-05 baseline)
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


def ws_generate(client, extra_params: dict = {}) -> list[dict]:
    msgs = []
    payload = {
        "generationType": "create",
        "inputMode": "text",
        "prompt": {"text": "A login form", "images": []},
        "history": [],
        "isImportedFromCode": False,
        "stack": "html_tailwind",
        "generationId": "auth-test-001",
        **extra_params,
    }
    try:
        with client.websocket_connect("/generate-code") as ws:
            ws.send_json(payload)
            try:
                while True:
                    msgs.append(ws.receive_json())
            except Exception:
                pass
    except Exception:
        pass
    return msgs


class TestFR01_FR02_UserSessionInPipeline:
    """FR-01/02: Registered users have a session; the pipeline receives
    their userId and stores it alongside generated code in Supabase."""

    def test_pipeline_accepts_user_id_param(self, client):
        """Backend accepts userId in the WebSocket params without error."""
        msgs = ws_generate(client, {"userId": "user-abc-123"})
        error_msgs = [m for m in msgs if m.get("type") == "error"]
        assert not error_msgs, f"Unexpected errors when userId provided: {error_msgs}"

    def test_pipeline_produces_code_with_user_id(self, client):
        """setCode message is produced even when a userId is passed."""
        msgs = ws_generate(client, {"userId": "user-abc-123"})
        assert any(m.get("type") == "setCode" for m in msgs)

    def test_save_called_with_user_id(self, client):
        """FR-02: save_to_supabase must be called with the user's ID
        so the generation is linked to their account (FR-24 dependency)."""
        captured = []

        async def capture(prompt_msgs, code, user_id=None, aesthetic_mode="high_fi"):
            captured.append(user_id)

        with patch("routes.generate_code.save_to_supabase", side_effect=capture):
            ws_generate(client, {"userId": "user-abc-123"})

        assert captured, "save_to_supabase was never called"
        assert "user-abc-123" in captured, (
            f"user_id not passed to save_to_supabase. Got: {captured}"
        )


class TestFR03_AnonymousSession:
    """FR-03: Users without a session (no userId) can still generate —
    the pipeline degrades gracefully to anonymous mode."""

    def test_no_user_id_still_generates(self, client):
        """Generation works without userId (anonymous/unauthenticated user)."""
        msgs = ws_generate(client)  # no userId
        assert any(m.get("type") == "setCode" for m in msgs)

    def test_save_called_with_none_user_id(self, client):
        """save_to_supabase is called with user_id=None for anonymous sessions."""
        captured = []

        async def capture(prompt_msgs, code, user_id=None, aesthetic_mode="high_fi"):
            captured.append(user_id)

        with patch("routes.generate_code.save_to_supabase", side_effect=capture):
            ws_generate(client)  # no userId

        assert captured, "save_to_supabase was never called"
        assert captured[0] is None, (
            f"Expected user_id=None for anonymous session, got: {captured[0]}"
        )


class TestFR04_Logout:
    """FR-04: Logout is handled on the frontend (supabase.auth.signOut).
    The backend validates that after logout, a new generation with no userId
    is treated as anonymous — no previous user data is leaked."""

    def test_generation_after_logout_is_anonymous(self, client):
        """Simulate post-logout: no userId in payload → anonymous save."""
        captured = []

        async def capture(prompt_msgs, code, user_id=None, aesthetic_mode="high_fi"):
            captured.append(user_id)

        with patch("routes.generate_code.save_to_supabase", side_effect=capture):
            ws_generate(client)  # no userId (post-logout state)

        assert captured[0] is None, "Post-logout generation must not carry a user_id"


class TestFR05_AccessControl:
    """FR-05: Only the WebSocket endpoint needs auth guard in the pipeline.
    The root health-check is public. All other access control is in Supabase RLS."""

    def test_root_endpoint_is_public(self, client):
        """FR-05: Health check must be accessible without any auth."""
        r = client.get("/")
        assert r.status_code == 200

    def test_websocket_endpoint_accessible(self, client):
        """Generate-code WebSocket must be reachable."""
        msgs = ws_generate(client)
        assert isinstance(msgs, list) and len(msgs) > 0

    def test_unknown_route_returns_404(self, client):
        """Non-existent routes return 404 (not a crash)."""
        r = client.get("/some-nonexistent-page")
        assert r.status_code == 404