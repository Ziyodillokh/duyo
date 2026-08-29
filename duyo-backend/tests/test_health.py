"""Smoke test for the FastAPI app."""

from fastapi.testclient import TestClient

from duyo.main import app


def test_health_returns_ok():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["env"] == "development"
    assert body["version"]


def test_all_v1_routers_are_mounted():
    """Guard: every feature router must be reachable under /v1.

    Endpoint functions are unit-tested directly with fake sessions, which does
    not catch a router that was never included in api_v1. This asserts the
    actual app exposes each feature's route prefix.

    Reads the OpenAPI schema rather than app.routes: the schema lists final
    mounted paths regardless of how FastAPI represents included routers
    internally (app.routes broke on the _IncludedRouter change).
    """
    paths = set(app.openapi()["paths"])
    expected_prefixes = (
        "/v1/chat",
        "/v1/gamification",
        "/v1/tamagochi",
        "/v1/subscriptions",
        "/v1/social",
        "/v1/admin",
    )
    for prefix in expected_prefixes:
        assert any(path.startswith(prefix) for path in paths), (
            f"No route mounted under {prefix}"
        )
