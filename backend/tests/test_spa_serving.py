import os
import pytest
from fastapi.testclient import TestClient

import sys
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_api_index(client):
    """GET /api returns the standard Yonru API v2 status."""
    res = client.get("/api")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "service": "Yonru API v2"}

def test_spa_root_serves_index(client, tmp_path, monkeypatch):
    """GET / serves index.html if present in frontend build directory."""
    # Point frontend_dist to tmp_path
    index_file = tmp_path / "index.html"
    index_file.write_text("<!DOCTYPE html><html><body>Yonru App</body></html>", encoding="utf-8")
    
    import main
    monkeypatch.setattr(main, "frontend_dist", str(tmp_path))
    
    res = client.get("/")
    assert res.status_code == 200
    assert "Yonru App" in res.text

def test_spa_fallback_for_client_routes(client, tmp_path, monkeypatch):
    """GET /editor or /settings falls back to index.html if route not a static file."""
    index_file = tmp_path / "index.html"
    index_file.write_text("<!DOCTYPE html><html><body>Yonru App SPA</body></html>", encoding="utf-8")
    
    import main
    monkeypatch.setattr(main, "frontend_dist", str(tmp_path))
    
    res = client.get("/editor")
    assert res.status_code == 200
    assert "Yonru App SPA" in res.text
    
    res = client.get("/settings")
    assert res.status_code == 200
    assert "Yonru App SPA" in res.text

def test_spa_serves_exact_static_file_when_present(client, tmp_path, monkeypatch):
    """GET /robots.txt serves the exact file from frontend_dist."""
    robots_file = tmp_path / "robots.txt"
    robots_file.write_text("User-agent: *\nDisallow: /", encoding="utf-8")
    
    import main
    monkeypatch.setattr(main, "frontend_dist", str(tmp_path))
    
    res = client.get("/robots.txt")
    assert res.status_code == 200
    assert "User-agent: *" in res.text

def test_api_and_assets_404_not_intercepted_by_spa(client, tmp_path, monkeypatch):
    """Non-existent API or asset routes return 404 and are NOT intercepted by SPA fallback."""
    index_file = tmp_path / "index.html"
    index_file.write_text("<!DOCTYPE html><html><body>Yonru App SPA</body></html>", encoding="utf-8")
    
    import main
    monkeypatch.setattr(main, "frontend_dist", str(tmp_path))
    
    res = client.get("/api/nonexistent-endpoint")
    assert res.status_code == 404
    assert "Yonru App SPA" not in res.text
    
    res = client.get("/static/nonexistent.mp4")
    assert res.status_code == 404
    assert "Yonru App SPA" not in res.text

    res = client.get("/assets/nonexistent.jpg")
    assert res.status_code == 404
    assert "Yonru App SPA" not in res.text
