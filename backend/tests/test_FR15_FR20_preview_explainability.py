"""
FR-15 to FR-20 — Component Structure, Preview & Explainability
===============================================================
FR-15  Parse generated UI into structured hierarchical component tree
FR-16  Tag generated code blocks with unique identifiers
FR-17  Render generated code in secure sandboxed preview
FR-18  Optional explainability view (logic toggle) over UI
FR-19  Allow users to copy generated UI code for external use
FR-20  Provide code editor view with syntax highlighting

These tests validate the codegen utility layer and WebSocket output
that underpins these features (the frontend sandbox/editor themselves
are tested via UAT, not backend unit tests).
"""

import os, re
import pytest
os.environ["MOCK"] = "True"

from codegen.utils import extract_html_content


class TestFR15_ComponentTreeParsing:
    """FR-15: Generated HTML must be parseable into a component hierarchy.
    We test the extract_html_content utility that feeds the component parser."""

    def test_full_page_html_extractable(self):
        html = (
            "<html><body>"
            "<nav>Nav</nav>"
            "<main><section>Hero</section><aside>Sidebar</aside></main>"
            "<footer>Footer</footer>"
            "</body></html>"
        )
        result = extract_html_content(html)
        # All structural tags must be present for the component tree parser
        for tag in ["<nav>", "<main>", "<section>", "<aside>", "<footer>"]:
            assert tag in result, f"Structural tag {tag} lost during extraction"

    def test_nested_components_preserved(self):
        html = (
            "<html><body>"
            "<div class='card'><div class='card-header'>Title</div>"
            "<div class='card-body'>Content</div></div>"
            "</body></html>"
        )
        result = extract_html_content(html)
        assert "card-header" in result
        assert "card-body" in result

    def test_react_component_ids_preserved(self):
        """FR-16: data-component or id attributes used for tracking must survive."""
        html = (
            '<html><body>'
            '<div id="navbar" data-component="Navbar">Nav</div>'
            '<div id="hero" data-component="Hero">Hero</div>'
            '</body></html>'
        )
        result = extract_html_content(html)
        assert 'id="navbar"' in result
        assert 'data-component="Navbar"' in result


class TestFR16_UniqueIdentifiers:
    """FR-16: Component tracking requires id / data-* attributes to be present
    and unique in the generated output."""

    def test_id_attributes_not_stripped_by_extractor(self):
        html = '<html><body><section id="hero-section">Hero</section></body></html>'
        assert 'id="hero-section"' in extract_html_content(html)

    def test_data_attributes_not_stripped(self):
        html = '<html><body><div data-testid="navbar" data-component="Navbar"></div></body></html>'
        result = extract_html_content(html)
        assert 'data-testid="navbar"' in result
        assert 'data-component="Navbar"' in result


class TestFR17_SandboxSecurity:
    """FR-17: Preview must run in a sandboxed environment — XSS vectors
    must NOT be able to escape the sandbox from generated code.
    We verify that extract_html_content does not further inject scripts."""

    XSS_VECTORS = [
        '<html><body><script>alert(1)</script></body></html>',
        '<html><body><img src=x onerror="alert(1)"/></body></html>',
        '<html><body onload="alert(1)"></body></html>',
    ]

    @pytest.mark.parametrize("xss_html", XSS_VECTORS)
    def test_extract_does_not_add_extra_scripts(self, xss_html):
        """extract_html_content must return exactly the <html>…</html> fragment —
        it must not wrap content in additional executable contexts."""
        result = extract_html_content(xss_html)
        # Result should still be an html string — we verify it doesn't
        # introduce NEW script elements beyond what was in the original
        original_script_count = xss_html.lower().count("<script")
        result_script_count = result.lower().count("<script")
        assert result_script_count <= original_script_count, (
            "extract_html_content added script tags — sandbox integrity risk"
        )

    def test_extract_does_not_inject_external_resources(self):
        """Extractor must not add any external src= references."""
        html = "<html><body><p>Hello</p></body></html>"
        result = extract_html_content(html)
        assert "cdn." not in result
        assert "http://" not in result
        assert "https://" not in result


class TestFR18_ExplainabilityView:
    """FR-18: Logic toggle / explainability overlay must not affect the underlying
    code. Validated via structure preservation in extracted output."""

    def test_layout_attributes_preserved_for_overlay(self):
        """CSS class names needed by the overlay (flex, grid, container) must survive."""
        html = (
            '<html><body>'
            '<div class="flex flex-col min-h-screen">'
            '<header class="w-full bg-white shadow">Header</header>'
            '<main class="flex-1 container mx-auto">Content</main>'
            '</div></body></html>'
        )
        result = extract_html_content(html)
        assert "flex" in result
        assert "container" in result

    def test_grid_layout_classes_preserved(self):
        html = (
            '<html><body>'
            '<div class="grid grid-cols-3 gap-4">'
            '<div class="col-span-1">Sidebar</div>'
            '<div class="col-span-2">Main</div>'
            '</div></body></html>'
        )
        result = extract_html_content(html)
        assert "grid-cols-3" in result
        assert "col-span-2" in result


class TestFR19_CopyCode:
    """FR-19: Code copy requires the full raw string to be available.
    Validate that extract_html_content returns a complete, copy-ready string."""

    def test_extracted_html_is_complete_string(self):
        html = "<html><body><h1>Title</h1></body></html>"
        result = extract_html_content(html)
        assert isinstance(result, str)
        assert len(result) > 0

    def test_extracted_html_starts_with_html_tag(self):
        html = "<html><body></body></html>"
        result = extract_html_content(html)
        assert result.startswith("<html")

    def test_extracted_html_ends_with_closing_html(self):
        html = "<html><body><p>Test</p></body></html>"
        result = extract_html_content(html)
        assert result.endswith("</html>")


class TestFR20_CodeEditorView:
    """FR-20: Code editor requires syntax-intact source — no binary encoding or
    truncation from the backend pipeline."""

    def test_html_special_chars_preserved(self):
        """Angle brackets, quotes, and ampersands must survive extraction
        so the code editor renders them correctly."""
        html = '<html><body><p class="text &amp; style">Hello &lt;World&gt;</p></body></html>'
        result = extract_html_content(html)
        assert "&amp;" in result or "&" in result
        assert "text" in result

    def test_multiline_indented_code_preserved(self):
        html = (
            "<html>\n"
            "  <head>\n"
            "    <title>Page</title>\n"
            "  </head>\n"
            "  <body>\n"
            "    <main>\n"
            "      <h1>Title</h1>\n"
            "    </main>\n"
            "  </body>\n"
            "</html>"
        )
        result = extract_html_content(html)
        assert "  <head>" in result
        assert "    <title>" in result