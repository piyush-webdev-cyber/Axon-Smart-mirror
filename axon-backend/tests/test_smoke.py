"""Smoke tests for the Phase 1 foundation."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_ok() -> None:
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["service"] == "axon-backend"


def test_system_info() -> None:
    res = client.get("/api/v1/system/info")
    assert res.status_code == 200
    assert res.json()["phase"] == 1


def test_protected_requires_auth() -> None:
    res = client.get("/api/v1/users/me")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "unauthorized"


def test_voice_process_time() -> None:
    res = client.post(
        "/api/v1/voice/process",
        json={"transcript": "Nexa, what time is it"},
    )
    assert res.status_code == 200
    body = res.json()
    assert "reply" in body
    assert body.get("action") is None


def test_voice_take_photo() -> None:
    res = client.post(
        "/api/v1/voice/process",
        json={"transcript": "Nexa, take a photo"},
    )
    assert res.status_code == 200
    assert res.json()["action"] == "take_photo"


def test_voice_show_gallery_qr() -> None:
    res = client.post(
        "/api/v1/voice/process",
        json={"transcript": "Nexa, show my photos"},
    )
    assert res.status_code == 200
    assert res.json()["action"] == "show_gallery_qr"
