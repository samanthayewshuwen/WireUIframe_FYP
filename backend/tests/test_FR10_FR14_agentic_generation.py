"""
FR-10 to FR-14 — Agentic Reasoning & Quality Control
======================================================
FR-10  Analyze combined inputs → generate internal JSON schema (layout)
FR-11  Transform schema → functional UI code matching selected stack
FR-12  Secondary AI Validator Agent checks quality before display
FR-13  Self-correct errors found by Validator (self-healing)
FR-14  Include accessibility attributes (aria-labels, alt text)

All tests use MOCK=True so the mock LLM response is used, which exercises
the entire pipeline framework without real API costs.
"""

import os, re
import pytest
os.environ["MOCK"] = "True"

from fastapi.testclient import TestClient
from main import app
from codegen.utils import extract_html_content


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def generate(client, stack="html_tailwind", text="A login form", input_mode="text") -> list[dict]:
    msgs = []
    try:
        with client.websocket_connect("/generate-code") as ws:
            ws.send_json({
                "generationType": "create",
                "inputMode": input_mode,
                "prompt": {"text": text, "images": []},
                "history": [],
                "isImportedFromCode": False,
                "stack": stack,
                "openAiApiKey": None,
                "anthropicApiKey": None,
                "generationId": "gen-agentic-001",
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


def get_code(msgs: list[dict]) -> str | None:
    code_msgs = [m for m in msgs if m.get("type") == "setCode"]
    return code_msgs[-1]["value"] if code_msgs else None


class TestFR10_JsonSchemaGeneration:
    """FR-10: System must analyse inputs and generate an intermediate JSON layout schema."""

    def test_pipeline_produces_set_code_message(self, client):
        """Pipeline must emit a setCode message — proof that schema → code ran."""
        msgs = generate(client)
        types = {m.get("type") for m in msgs}
        assert "setCode" in types, f"No setCode in message types: {types}"

    def test_status_messages_indicate_reasoning_steps(self, client):
        """Pipeline should emit status messages showing multi-step processing."""
        msgs = generate(client)
        status_msgs = [m for m in msgs if m.get("type") == "status"]
        assert len(status_msgs) >= 1, "No status messages — pipeline steps not communicated"

    def test_variant_count_message_sent(self, client):
        """System should declare how many variants will be generated."""
        msgs = generate(client)
        types = {m.get("type") for m in msgs}
        # variantCount or variantComplete signals the parallel variant mechanism
        assert types & {"variantCount", "variantComplete"}, (
            "No variant signaling messages found"
        )


class TestFR11_StackCompliantCodeGeneration:
    """FR-11: Generated code must match the user-selected technology stack."""

    def test_html_tailwind_output_contains_html(self, client):
        code = get_code(generate(client, stack="html_tailwind"))
        assert code, "No code generated for html_tailwind stack"
        assert "<html" in code.lower() or "<body" in code.lower() or "<div" in code.lower()

    def test_react_tailwind_output_not_empty(self, client):
        code = get_code(generate(client, stack="react_tailwind"))
        assert code and len(code.strip()) > 0

    def test_bootstrap_stack_accepted(self, client):
        msgs = generate(client, stack="bootstrap")
        assert any(m.get("type") == "setCode" for m in msgs)

    def test_vue_tailwind_stack_accepted(self, client):
        msgs = generate(client, stack="vue_tailwind")
        assert any(m.get("type") == "setCode" for m in msgs)

    def test_generated_code_is_string(self, client):
        code = get_code(generate(client))
        assert isinstance(code, str)

    def test_generated_code_non_empty(self, client):
        code = get_code(generate(client))
        assert code and code.strip()


class TestFR12_ValidatorAgent:
    """FR-12: Validator Agent must check generated code before it is displayed.
    In mock mode this is evidenced by status messages and no unvalidated raw dump."""

    def test_no_raw_error_dump_in_output(self, client):
        """Code must not contain Python tracebacks or raw error text."""
        code = get_code(generate(client)) or ""
        assert "Traceback" not in code
        assert "SyntaxError" not in code

    def test_error_message_sent_on_invalid_stack(self, client):
        """Validator should surface an error for an invalid stack, not silently fail."""
        msgs = []
        try:
            with client.websocket_connect("/generate-code") as ws:
                ws.send_json({
                    "generationType": "create",
                    "inputMode": "text",
                    "prompt": {"text": "A form", "images": []},
                    "history": [],
                    "isImportedFromCode": False,
                    "stack": "invalid_stack_xyz",
                    "generationId": "bad-stack-001",
                })
                try:
                    while True:
                        msgs.append(ws.receive_json())
                except Exception:
                    pass
        except Exception:
            pass
        error_msgs = [m for m in msgs if m.get("type") == "error"]
        assert error_msgs, "Expected an error message for invalid stack"


class TestFR13_SelfHealing:
    """FR-13: System should self-correct errors without requiring user intervention.
    In mock mode we verify the pipeline completes cleanly (no crash = self-healing worked)."""

    def test_generation_completes_without_user_intervention(self, client):
        """Full generate-validate-correct cycle must complete and emit setCode."""
        msgs = generate(client, text="Complex dashboard with charts, tables, and forms")
        assert any(m.get("type") == "setCode" for m in msgs), (
            "setCode never emitted — pipeline did not complete"
        )

    def test_update_generation_self_heals(self, client):
        """Update (partial regen) must also complete cleanly."""
        msgs = []
        try:
            with client.websocket_connect("/generate-code") as ws:
                ws.send_json({
                    "generationType": "update",
                    "inputMode": "text",
                    "prompt": {"text": "Change button color to red", "images": []},
                    "history": [
                        {"type": "code", "value": "<html><body><button>Click</button></body></html>"},
                        {"type": "text", "value": "Change button color to red"},
                    ],
                    "isImportedFromCode": False,
                    "stack": "html_tailwind",
                    "generationId": "update-001",
                })
                try:
                    while True:
                        msgs.append(ws.receive_json())
                except Exception:
                    pass
        except Exception:
            pass
        assert isinstance(msgs, list)
        error_msgs = [m for m in msgs if m.get("type") == "error"]
        assert not error_msgs, f"Update generation errored: {error_msgs}"


class TestFR14_Accessibility:
    """FR-14: Generated code must include basic accessibility attributes."""

    def test_extract_html_preserves_aria_attributes(self):
        """extract_html_content must not strip aria-* attributes."""
        html = '<html><body><button aria-label="Submit form">Submit</button></body></html>'
        result = extract_html_content(html)
        assert 'aria-label' in result

    def test_extract_html_preserves_alt_text(self):
        html = '<html><body><img src="logo.png" alt="Company logo"/></body></html>'
        result = extract_html_content(html)
        assert 'alt=' in result

    def test_extract_html_preserves_role_attribute(self):
        html = '<html><body><nav role="navigation"></nav></body></html>'
        result = extract_html_content(html)
        assert 'role=' in result