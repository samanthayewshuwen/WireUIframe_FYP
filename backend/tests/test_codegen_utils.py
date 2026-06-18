"""
Tests for codegen/utils.py
Module: Multimodal Input Handling / Agentic Schema-First Generation
Covers: HTML content extraction from raw LLM output strings
"""

import pytest
from codegen.utils import extract_html_content


class TestExtractHtmlContent:
    """FR: Code generation pipeline must extract valid HTML from LLM output."""

    # ── Happy-path cases ────────────────────────────────────────────────────

    def test_full_html_document_returned_verbatim(self):
        text = "<html><body><p>Hello</p></body></html>"
        assert extract_html_content(text) == text

    def test_html_with_lang_attribute(self):
        text = '<html lang="en"><head></head><body></body></html>'
        assert extract_html_content(text) == text

    def test_strips_doctype_prefix(self):
        """DOCTYPE must be removed so the preview iframe renders cleanly."""
        text = '<!DOCTYPE html><html lang="en"><head></head><body></body></html>'
        expected = '<html lang="en"><head></head><body></body></html>'
        assert extract_html_content(text) == expected

    def test_extracts_html_when_preamble_text_present(self):
        """LLM often prepends an explanation before the code block."""
        text = (
            "Sure! Here is your updated code:\n\n"
            '<html lang="en"><head></head><body class="bg-black text-white"></body></html>'
        )
        expected = '<html lang="en"><head></head><body class="bg-black text-white"></body></html>'
        assert extract_html_content(text) == expected

    def test_returns_first_html_block_when_multiple_present(self):
        """Only the first complete html block should be returned."""
        text = (
            "<html><body><p>First</p></body></html>"
            " Some text "
            "<html><body><p>Second</p></body></html>"
        )
        expected = "<html><body><p>First</p></body></html>"
        assert extract_html_content(text) == expected

    def test_multiline_html_body(self):
        text = "<html>\n  <body>\n    <h1>Title</h1>\n  </body>\n</html>"
        assert extract_html_content(text) == text

    # ── Edge cases / fallback behaviour ─────────────────────────────────────

    def test_no_html_tags_returns_original_text(self):
        """Fallback: if no <html> found, return raw LLM output unchanged."""
        text = "No HTML content here."
        assert extract_html_content(text) == text

    def test_partial_html_missing_closing_tag_returns_original(self):
        """Partial content (no </html>) falls back to the original string."""
        text = "<html><body><p>Hello</p></body>"
        # regex requires </html> to match, so it falls back
        assert extract_html_content(text) == text

    def test_markdown_code_fence_without_html_tags_returned_as_is(self):
        text = "```html<head></head>```"
        assert extract_html_content(text) == text

    def test_empty_string_returns_empty_string(self):
        assert extract_html_content("") == ""

    def test_whitespace_only_returns_whitespace(self):
        assert extract_html_content("   ") == "   "

    def test_html_with_inline_scripts(self):
        text = (
            "<html><head><script>alert('hi')</script></head>"
            "<body></body></html>"
        )
        assert extract_html_content(text) == text

    def test_html_with_tailwind_classes(self):
        text = (
            '<html><body class="min-h-screen bg-gray-100 flex items-center">'
            "<p>Content</p></body></html>"
        )
        assert extract_html_content(text) == text