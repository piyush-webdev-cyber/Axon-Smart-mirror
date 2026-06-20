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


def test_placeholder_returns_501() -> None:
    res = client.post("/api/v1/voice")
    assert res.status_code == 501
    assert res.json()["error"]["code"] == "not_implemented"
