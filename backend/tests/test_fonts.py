import pytest
import os
import json
import sys
import tempfile
import shutil

# Enable root imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

import download_fonts

class MockFontDownloaderClient(download_fonts.FontDownloaderClient):
    """
    Mock downloader client that intercepts HTTP requests and disk writes,
    recording them for zero-flakiness deterministic unit testing.
    """
    def __init__(self, mock_gwfh_responses=None):
        self.mock_gwfh_responses = mock_gwfh_responses or {}
        self.downloaded_urls = []
        self.written_files = {}

    def fetch_json(self, url: str) -> dict:
        # Resolve font ID from url: https://gwfh.mranftl.com/api/fonts/outfit?subsets=latin
        font_id = url.split('/')[-1].split('?')[0]
        if font_id in self.mock_gwfh_responses:
            return self.mock_gwfh_responses[font_id]
        raise Exception(f"Unexpected API call to {url}")

    def download_file(self, url: str, dest_path: str) -> None:
        self.downloaded_urls.append(url)
        # Store file contents in-memory to verify without actual disk I/O
        self.written_files[dest_path] = b"mock-woff2-data"


def test_font_manager_sync_downloads_missing_and_compiles_css(tmp_path):
    """
    TDD Test: Verify FontManager reads the shared manifest, resolves variants,
    calls the downloader client seam, and compiles CSS paths with tailored relative paths.
    """
    # 1. Create temporary directory structure for frontend assets
    font_dir = tmp_path / "frontend" / "app" / "assets" / "fonts"
    frontend_css = tmp_path / "frontend" / "app" / "assets" / "css" / "fonts.css"
    remotion_css = tmp_path / "remotion_engine" / "src" / "fonts.css"
    manifest_file = tmp_path / "shared" / "fonts_manifest.json"

    os.makedirs(font_dir, exist_ok=True)
    os.makedirs(frontend_css.parent, exist_ok=True)
    os.makedirs(remotion_css.parent, exist_ok=True)
    os.makedirs(manifest_file.parent, exist_ok=True)

    # 2. Write a minimal mock manifest
    manifest_data = {
        "fonts": [
            {"name": "Bebas Neue", "id": "bebas-neue"},
            {"name": "Outfit", "id": "outfit"}
        ]
    }
    with open(manifest_file, 'w') as f:
        json.dump(manifest_data, f)

    # 3. Pre-create Outfit font to simulate an existing local asset
    outfit_font_file = font_dir / "outfit" / "outfit-400-normal.woff2"
    os.makedirs(outfit_font_file.parent, exist_ok=True)
    with open(outfit_font_file, 'wb') as f:
        f.write(b"existing-asset")

    # 4. Mock responses from the GWFH API
    mock_responses = {
        "bebas-neue": {
            "variants": [
                {
                    "fontWeight": "400",
                    "fontStyle": "normal",
                    "woff2": "https://fonts.gwfh.com/bebas-neue-400.woff2"
                }
            ]
        },
        "outfit": {
            "variants": [
                {
                    "fontWeight": "400",
                    "fontStyle": "normal",
                    "woff2": "https://fonts.gwfh.com/outfit-400.woff2"
                }
            ]
        }
    }

    mock_downloader = MockFontDownloaderClient(mock_responses)

    # 5. Instantiate deep FontManager class and run synchronization
    manager = download_fonts.FontManager(
        manifest_path=str(manifest_file),
        font_dir=str(font_dir),
        frontend_css=str(frontend_css),
        remotion_css=str(remotion_css),
        downloader=mock_downloader
    )

    success = manager.sync()
    assert success is True

    # 6. Verify Seam Invariants:
    # A. Should ONLY request download for missing font ("bebas-neue"), NOT "outfit"
    assert "https://fonts.gwfh.com/bebas-neue-400.woff2" in mock_downloader.downloaded_urls
    assert "https://fonts.gwfh.com/outfit-400.woff2" not in mock_downloader.downloaded_urls

    # B. Verify mock downloader received correct destination paths in mock dictionary
    expected_bebas_dest = os.path.join(str(font_dir), "bebas-neue", "bebas-neue-400-normal.woff2")
    assert expected_bebas_dest in mock_downloader.written_files

    # C. Verify Nuxt stylesheet generated with relative path "../fonts"
    assert os.path.exists(str(frontend_css))
    with open(frontend_css, 'r') as f:
        frontend_css_content = f.read()
    assert "@font-face" in frontend_css_content
    assert "font-family: 'Bebas Neue';" in frontend_css_content
    assert "url('../fonts/bebas-neue/bebas-neue-400-normal.woff2')" in frontend_css_content

    # D. Verify Remotion stylesheet generated with relative path "./assets/fonts"
    assert os.path.exists(str(remotion_css))
    with open(remotion_css, 'r') as f:
        remotion_css_content = f.read()
    assert "@font-face" in remotion_css_content
    assert "font-family: 'Bebas Neue';" in remotion_css_content
    assert "url('./assets/fonts/bebas-neue/bebas-neue-400-normal.woff2')" in remotion_css_content
