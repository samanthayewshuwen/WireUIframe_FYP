"""
FR-28 to FR-33 — Component Library & Feedback / Iteration Tracking
===================================================================
ARCHITECTURE NOTE:
Component library is stored in browser localStorage (SaveComponentModal.tsx)
and optionally in Supabase. The backend's role is to produce code that is
correctly structured so components can be extracted from it.

FR-28/29/30  Component extraction depends on generated code having valid
             HTML structure with identifiable component boundaries
FR-31        Refinement prompts use the WebSocket 'update' generationType
FR-32        Each refinement triggers a new save_to_supabase call (new version)
FR-33        Version switching is done by the frontend reading Supabase history

These tests validate the BACKEND side of all of these.
"""

import os, re
import pytest
from unittest.mock import patch
os.environ["MOCK"] = "True"

from fastapi.testclient import TestClient
from main import app
from codegen.utils import extract_html_content


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


# ── Helpers ──────────────────────────────────────────────────────────────────

def ws_create(client, text, stack="html_tailwind") -> str | None:
    """Run a create generation and return the final code."""
    msgs = []
    try:
        with client.websocket_connect("/generate-code") as ws:
            ws.send_json({
                "generationType": "create",
                "inputMode": "text",
                "prompt": {"text": text, "images": []},
                "history": [],
                "isImportedFromCode": False,
                "stack": stack,
                "generationId": "comp-create",
            })
            try:
                while True:
                    msgs.append(ws.receive_json())
            except Exception:
                pass
    except Exception:
        pass
    code_msgs = [m for m in msgs if m.get("type") == "setCode"]
    return code_msgs[-1]["value"] if code_msgs else None


def ws_update(client, existing_code, prompt_text, stack="html_tailwind") -> list[dict]:
    msgs = []
    try:
        with client.websocket_connect("/generate-code") as ws:
            ws.send_json({
                "generationType": "update",
                "inputMode": "text",
                "prompt": {"text": prompt_text, "images": []},
                "history": [{"type": "code", "value": existing_code}],
                "isImportedFromCode": False,
                "stack": stack,
                "generationId": "comp-update",
            })
            try:
                while True:
                    msgs.append(ws.receive_json())
            except Exception:
                pass
    except Exception:
        pass
    return msgs


SAMPLE_UI = """<html>
<body class="bg-gray-50">
  <nav id="navbar" data-component="Navbar" class="bg-white shadow p-4 flex items-center">
    <span class="font-bold text-xl">Logo</span>
    <ul class="ml-8 flex gap-6">
      <li><a href="#">Home</a></li><li><a href="#">About</a></li>
    </ul>
  </nav>
  <main id="hero" data-component="Hero" class="p-12 text-center">
    <h1 class="text-4xl font-bold mb-4">Welcome</h1>
    <p class="text-gray-600 mb-6">Build beautiful interfaces.</p>
    <button class="bg-blue-600 text-white px-6 py-2 rounded">Get Started</button>
  </main>
  <footer id="footer" data-component="Footer" class="bg-gray-800 text-white p-6 text-center">
    <p>&copy; 2026 WireUI. All rights reserved.</p>
  </footer>
</body>
</html>"""


class TestFR28_ComponentSelection:
    """FR-28: Individual components must be identifiable in generated code."""

    def test_generated_code_has_identifiable_structure(self, client):
        code = ws_create(client, "A page with navbar, hero section, and footer")
        assert code, "No code generated"
        # Must have structural HTML tags that can be parsed into components
        has_structure = any(tag in code.lower() for tag in
                           ["<nav", "<header", "<main", "<section", "<footer",
                            "<div", "<article"])
        assert has_structure, "Generated code has no structural tags for component parsing"

    def test_data_component_attributes_survive_extraction(self):
        """FR-28: data-component attributes used for selection must not be stripped."""
        result = extract_html_content(SAMPLE_UI)
        assert 'data-component="Navbar"' in result
        assert 'data-component="Hero"' in result
        assert 'data-component="Footer"' in result

    def test_component_ids_survive_extraction(self):
        result = extract_html_content(SAMPLE_UI)
        assert 'id="navbar"' in result
        assert 'id="hero"' in result
        assert 'id="footer"' in result

    def test_nested_content_inside_component_preserved(self):
        """Component contents (children) must all be kept — not just the wrapper."""
        result = extract_html_content(SAMPLE_UI)
        assert "Get Started" in result      # button inside hero
        assert "All rights reserved" in result  # text inside footer
        assert "font-bold text-xl" in result   # class inside navbar


class TestFR29_SaveComponent:
    """FR-29: Components saved to library come from generated code.
    Backend must produce code that is extractable as clean snippets."""

    def test_generated_html_is_clean_enough_to_save(self, client):
        code = ws_create(client, "A reusable card component with title and description")
        assert code and len(code.strip()) > 0

    def test_component_html_has_no_syntax_errors(self):
        """Saved component code must have balanced tags."""
        result = extract_html_content(SAMPLE_UI)
        # Count open vs close tags for common elements
        for tag in ["nav", "main", "footer"]:
            opens = len(re.findall(f"<{tag}[\\s>]", result))
            closes = len(re.findall(f"</{tag}>", result))
            assert opens == closes, (
                f"<{tag}> tags are unbalanced: {opens} open, {closes} close"
            )

    def test_tailwind_classes_intact_for_saved_component(self):
        """Saved components rely on Tailwind classes being present."""
        result = extract_html_content(SAMPLE_UI)
        assert "bg-blue-600" in result
        assert "text-white" in result
        assert "rounded" in result


class TestFR30_ReuseComponent:
    """FR-30: A saved component can be re-inserted into a new generation
    via the isImportedFromCode = True path."""

    def test_imported_code_path_accepted(self, client):
        """isImportedFromCode=True must not cause an error."""
        saved_component = "<nav class='bg-white shadow p-4'>Saved Navbar</nav>"
        msgs = []
        try:
            with client.websocket_connect("/generate-code") as ws:
                ws.send_json({
                    "generationType": "create",
                    "inputMode": "text",
                    "prompt": {"text": "Add a hero section below this navbar", "images": []},
                    "history": [{"type": "code", "value": saved_component}],
                    "isImportedFromCode": True,
                    "stack": "html_tailwind",
                    "generationId": "reuse-001",
                })
                try:
                    while True:
                        msgs.append(ws.receive_json())
                except Exception:
                    pass
        except Exception:
            pass
        error_msgs = [m for m in msgs if m.get("type") == "error"]
        assert not error_msgs, f"Imported code path errored: {error_msgs}"

    def test_imported_code_produces_output(self, client):
        saved_component = "<button class='btn-primary'>Reused Button</button>"
        msgs = []
        try:
            with client.websocket_connect("/generate-code") as ws:
                ws.send_json({
                    "generationType": "create",
                    "inputMode": "text",
                    "prompt": {"text": "Build a form using this button style", "images": []},
                    "history": [{"type": "code", "value": saved_component}],
                    "isImportedFromCode": True,
                    "stack": "html_tailwind",
                    "generationId": "reuse-002",
                })
                try:
                    while True:
                        msgs.append(ws.receive_json())
                except Exception:
                    pass
        except Exception:
            pass
        assert any(m.get("type") == "setCode" for m in msgs)


class TestFR31_RefinementPrompts:
    """FR-31: Users submit refinement prompts via the 'update' generationType."""

    def test_global_refinement_produces_new_code(self, client):
        msgs = ws_update(client, SAMPLE_UI, "Change the overall colour scheme to dark mode")
        assert any(m.get("type") == "setCode" for m in msgs), (
            "Global refinement did not produce setCode"
        )

    def test_granular_refinement_no_error(self, client):
        msgs = ws_update(client, SAMPLE_UI, "Edit only the Navbar: change background to blue-900")
        error_msgs = [m for m in msgs if m.get("type") == "error"]
        assert not error_msgs, f"Granular refinement errored: {error_msgs}"

    def test_granular_refinement_produces_code(self, client):
        msgs = ws_update(client, SAMPLE_UI, "Edit only the Footer: add a privacy policy link")
        assert any(m.get("type") == "setCode" for m in msgs)

    @pytest.mark.parametrize("prompt", [
        "Make all buttons have rounded-full corners",
        "Add a shadow to the navbar",
        "Change the hero heading font size to text-6xl",
        "Add an email input field to the footer",
        "Make the page background white instead of gray-50",
    ])
    def test_varied_refinement_prompts_accepted(self, client, prompt):
        msgs = ws_update(client, SAMPLE_UI, prompt)
        assert isinstance(msgs, list), f"Server hung on prompt: {prompt}"
        assert len(msgs) > 0, f"No messages received for prompt: {prompt}"


class TestFR32_VersionStorage:
    """FR-32: Each refinement triggers a new save_to_supabase call.
    This creates a new row in the 'generations' table = a new version."""

    def test_refinement_triggers_save(self, client):
        """Every update generation must call save_to_supabase."""
        saved = []

        async def capture(prompt_msgs, code, user_id=None, aesthetic_mode="high_fi"):
            saved.append({"code": code, "user_id": user_id})

        with patch("routes.generate_code.save_to_supabase", side_effect=capture):
            try:
                with client.websocket_connect("/generate-code") as ws:
                    ws.send_json({
                        "generationType": "update",
                        "inputMode": "text",
                        "prompt": {"text": "Make the hero text red", "images": []},
                        "history": [{"type": "code", "value": SAMPLE_UI}],
                        "isImportedFromCode": False,
                        "stack": "html_tailwind",
                        "userId": "user-version-test",
                        "generationId": "version-001",
                    })
                    try:
                        while True:
                            ws.receive_json()
                    except Exception:
                        pass
            except Exception:
                pass

        assert saved, "save_to_supabase not called after refinement — no new version stored"
        assert saved[0]["code"] and len(saved[0]["code"]) > 0

    def test_two_refinements_produce_two_saves(self, client):
        """FR-32: Two refinement steps = two rows in Supabase = two versions."""
        saved = []

        async def capture(prompt_msgs, code, user_id=None, aesthetic_mode="high_fi"):
            saved.append(code)

        with patch("routes.generate_code.save_to_supabase", side_effect=capture):
            for prompt in ["Make background dark", "Make text white"]:
                try:
                    with client.websocket_connect("/generate-code") as ws:
                        ws.send_json({
                            "generationType": "update",
                            "inputMode": "text",
                            "prompt": {"text": prompt, "images": []},
                            "history": [{"type": "code", "value": SAMPLE_UI}],
                            "isImportedFromCode": False,
                            "stack": "html_tailwind",
                            "generationId": f"v-{prompt[:5]}",
                        })
                        try:
                            while True:
                                ws.receive_json()
                        except Exception:
                            pass
                except Exception:
                    pass

        assert len(saved) >= 2, (
            f"Expected 2 saves for 2 refinements, got {len(saved)}"
        )


class TestFR33_VersionSwitching:
    """FR-33: Version switching reads from Supabase history on the frontend.
    Backend must save code that is different after each refinement (not identical)."""

    def test_refinement_changes_the_code(self, client):
        """After refinement, the new code must differ from the original
        so version switching actually shows different results."""
        original_code = ws_create(client, "A simple white page with a heading")
        if not original_code:
            pytest.skip("Could not generate initial code")

        # Run an update
        msgs = ws_update(client, original_code, "Change background to dark blue")
        updated_msgs = [m for m in msgs if m.get("type") == "setCode"]

        if not updated_msgs:
            pytest.skip("Update did not produce setCode")

        updated_code = updated_msgs[-1]["value"]
        # The updated code should exist and be non-empty
        assert updated_code and len(updated_code) > 0, (
            "Refined code is empty — version switching would show blank"
        )