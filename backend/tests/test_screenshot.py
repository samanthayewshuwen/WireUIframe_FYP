"""
Tests for routes/screenshot.py
Module: Multimodal Input Handling
Covers: URL normalisation (NFR-01-002 – input sanitisation) and
        bytes → data-URL conversion
"""

import base64
import pytest
from routes.screenshot import normalize_url, bytes_to_data_url


class TestNormalizeUrl:
    """FR: URLs submitted by users must be normalised before being
    passed to the screenshot API (prevents SSRF-style injection)."""

    # ── Protocol auto-injection ──────────────────────────────────────────

    def test_bare_domain_gets_https(self):
        assert normalize_url("example.com") == "https://example.com"

    def test_domain_with_path_gets_https(self):
        assert normalize_url("example.com/path/to/page") == "https://example.com/path/to/page"

    def test_domain_with_query_string_gets_https(self):
        assert normalize_url("example.com?foo=bar") == "https://example.com?foo=bar"

    def test_domain_with_port_gets_https(self):
        assert normalize_url("example.com:8080") == "https://example.com:8080"

    # ── Explicit valid protocols kept ────────────────────────────────────

    def test_https_url_unchanged(self):
        assert normalize_url("https://example.com") == "https://example.com"

    def test_http_url_unchanged(self):
        assert normalize_url("http://example.com") == "http://example.com"

    def test_https_with_path_unchanged(self):
        url = "https://example.com/some/deep/path?q=1&lang=en#anchor"
        assert normalize_url(url) == url

    # ── Whitespace handling ──────────────────────────────────────────────

    def test_leading_whitespace_stripped(self):
        assert normalize_url("  example.com") == "https://example.com"

    def test_trailing_whitespace_stripped(self):
        assert normalize_url("example.com  ") == "https://example.com"

    def test_both_sides_whitespace_stripped(self):
        assert normalize_url("  https://example.com  ") == "https://example.com"

    # ── Unsupported protocol raises ──────────────────────────────────────

    def test_ftp_raises_value_error(self):
        with pytest.raises(ValueError, match="Unsupported protocol"):
            normalize_url("ftp://files.example.com")

    def test_file_raises_value_error(self):
        with pytest.raises(ValueError, match="Unsupported protocol"):
            normalize_url("file:///etc/passwd")

    # ── Real-world inputs ────────────────────────────────────────────────

    def test_localhost_with_port(self):
        assert normalize_url("localhost:3000") == "https://localhost:3000"

    def test_ip_address(self):
        assert normalize_url("192.168.1.1") == "https://192.168.1.1"

    def test_subdomain(self):
        assert normalize_url("app.mysite.co.uk") == "https://app.mysite.co.uk"


class TestBytesToDataUrl:
    """FR: Captured screenshots must be base64-encoded for transport
    over the WebSocket / prompt messages."""

    def test_png_mime_type_prefix(self):
        data = b"\x89PNG\r\n"
        result = bytes_to_data_url(data, "image/png")
        assert result.startswith("data:image/png;base64,")

    def test_jpeg_mime_type_prefix(self):
        data = b"\xff\xd8\xff"
        result = bytes_to_data_url(data, "image/jpeg")
        assert result.startswith("data:image/jpeg;base64,")

    def test_base64_payload_is_decodable(self):
        original = b"hello world"
        result = bytes_to_data_url(original, "image/png")
        b64_part = result.split(",", 1)[1]
        assert base64.b64decode(b64_part) == original

    def test_empty_bytes_produces_valid_data_url(self):
        result = bytes_to_data_url(b"", "image/png")
        assert result == "data:image/png;base64,"

    def test_large_payload_round_trips(self):
        original = bytes(range(256)) * 100  # 25.6 KB
        result = bytes_to_data_url(original, "image/png")
        b64_part = result.split(",", 1)[1]
        assert base64.b64decode(b64_part) == original