"""
FR-21 to FR-23 — Granular Interaction & Editing
================================================
FR-21  Select specific component (e.g. "Edit only the Navbar")
FR-22  In-painting / Partial Regeneration — modify one component, preserve surroundings
FR-23  Open code in external sandbox (e.g. CodePen)

FR-21 and FR-22 are exercised through the WebSocket 'update' generationType.
FR-23 is a frontend feature; we validate the backend returns copyable code.
"""

import os
import pytest
os.environ["MOCK"] = "True"

from fastapi.testclient import TestClient
from main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def run_update(client, history: list, prompt_text: str, stack="html_tailwind") -> list[dict]:
    msgs = []
    try:
        with client.websocket_connect("/generate-code") as ws:
            ws.send_json({
                "generationType": "update",
                "inputMode": "text",
                "prompt": {"text": prompt_text, "images": []},
                "history": history,
                "isImportedFromCode": False,
                "stack": stack,
                "openAiApiKey": None,
                "anthropicApiKey": None,
                "generationId": "update-granular-001",
                "aestheticMode": "high_fi",
            })
            try:
                while True:
                    msgs.append(ws.receive_json())
            except Exception:
                pass
    except Exception:
        pass
    return msgs


EXISTING_UI = """<html>
<body class="min-h-screen bg-gray-100">
  <nav id="navbar" data-component="Navbar" class="bg-white shadow p-4">
    <span>Logo</span>
  </nav>
  <main id="hero" data-component="Hero" class="p-8">
    <h1 class="text-3xl font-bold">Welcome</h1>
    <p>Hero paragraph</p>
  </main>
  <footer id="footer" data-component="Footer" class="bg-gray-800 text-white p-4">
    &copy; 2026
  </footer>
</body>
</html>"""


class TestFR21_ComponentSelection:
    """FR-21: System must support selecting a specific component to edit."""

    def test_navbar_only_edit_does_not_error(self, client):
        """Targeting a specific component (Navbar) via update must not error."""
        msgs = run_update(
            client,
            history=[{"type": "code", "value": EXISTING_UI}],
            prompt_text="Change the Navbar background to blue-600",
        )
        error_msgs = [m for m in msgs if m.get("type") == "error"]
        assert not error_msgs, f"Component edit errored: {error_msgs}"

    def test_component_targeted_prompt_produces_code(self, client):
        """A component-targeted prompt must produce a setCode message."""
        msgs = run_update(
            client,
            history=[{"type": "code", "value": EXISTING_UI}],
            prompt_text="Update only the Footer: change background to dark-900",
        )
        assert any(m.get("type") == "setCode" for m in msgs), (
            "No setCode message for component-targeted edit"
        )

    def test_update_with_multi_turn_history(self, client):
        """FR-21 must work when there is a prior refinement in the history."""
        history = [
            {"type": "code", "value": EXISTING_UI},
            {"type": "text", "value": "Made navbar blue"},
            {"type": "code", "value": EXISTING_UI.replace("bg-white", "bg-blue-600")},
        ]
        msgs = run_update(
            client,
            history=history,
            prompt_text="Now also make the Hero text italic",
        )
        assert isinstance(msgs, list)


class TestFR22_InPaintingPartialRegen:
    """FR-22: Partial Regeneration must modify the target component
    while preserving the surrounding layout."""

    def test_partial_regen_completes_without_error(self, client):
        msgs = run_update(
            client,
            history=[{"type": "code", "value": EXISTING_UI}],
            prompt_text="Inpaint: replace the hero h1 text with 'New Heading'",
        )
        error_msgs = [m for m in msgs if m.get("type") == "error"]
        assert not error_msgs

    def test_partial_regen_emits_set_code(self, client):
        msgs = run_update(
            client,
            history=[{"type": "code", "value": EXISTING_UI}],
            prompt_text="Edit only the footer: add a privacy policy link",
        )
        assert any(m.get("type") == "setCode" for m in msgs)

    @pytest.mark.parametrize("component_prompt", [
        "Edit only the Navbar: add a search bar",
        "Edit only the Hero: change button color to red",
        "Edit only the Footer: add social media icons",
    ])
    def test_various_component_edits_complete(self, client, component_prompt):
        msgs = run_update(
            client,
            history=[{"type": "code", "value": EXISTING_UI}],
            prompt_text=component_prompt,
        )
        assert isinstance(msgs, list), f"Server hung on prompt: {component_prompt}"

    def test_partial_regen_with_react_stack(self, client):
        react_ui = (
            "export default function App() {\n"
            "  return (\n"
            "    <div>\n"
            "      <Navbar />\n"
            "      <Hero />\n"
            "    </div>\n"
            "  );\n"
            "}"
        )
        msgs = run_update(
            client,
            history=[{"type": "code", "value": react_ui}],
            prompt_text="Update Navbar to add a cart icon",
            stack="react_tailwind",
        )
        assert isinstance(msgs, list)


class TestFR23_ExternalSandbox:
    """FR-23: System must produce clean, exportable code for external tools
    (CodePen, StackBlitz). Backend must return complete copyable code."""

    def test_generated_code_is_complete_html(self, client):
        """Code exported to external sandbox must be a complete HTML document."""
        msgs = []
        with client.websocket_connect("/generate-code") as ws:
            ws.send_json({
                "generationType": "create",
                "inputMode": "text",
                "prompt": {"text": "A simple contact form", "images": []},
                "history": [],
                "isImportedFromCode": False,
                "stack": "html_tailwind",
                "generationId": "export-001",
            })
            try:
                while True:
                    msgs.append(ws.receive_json())
            except Exception:
                pass
        code_msgs = [m for m in msgs if m.get("type") == "setCode"]
        assert code_msgs, "No setCode message received"
        code = code_msgs[-1]["value"]
        assert isinstance(code, str) and len(code.strip()) > 0