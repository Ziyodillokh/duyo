"""What the internet can reach, and what it must not.

Three of these were confirmed live on api.duyo.uz before the fix: the crisis
oracle, Swagger, and the whole route map. They are asserted at the app level
rather than per-route because each one was a single line somewhere else that
undid the intent — a router mounted "internal-only" behind an nginx that
proxies everything, a FastAPI() built with its defaults.
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException

from duyo.api.v1 import subscription as subscription_module
from duyo.core.config import get_settings
from duyo.main import app, create_app
from duyo.schemas.subscription import SubscribeRequest


@pytest.fixture
def in_production(monkeypatch):
    monkeypatch.setattr(get_settings(), "app_env", "production")


def _route(endpoint_name: str):
    """Find a mounted route by the name of the function behind it.

    By endpoint, not by path: app.routes does not flatten included routers
    (tests/test_health.py hit the same trap), and the inner routes carry their
    path without the prefixes the app applies on the way in.
    """
    def walk(routes):
        for route in routes:
            yield route
            inner = getattr(route, "original_router", None)
            yield from walk(inner.routes if inner is not None else getattr(route, "routes", []))

    for route in walk(app.routes):
        if getattr(getattr(route, "endpoint", None), "__name__", None) == endpoint_name:
            return route
    raise AssertionError(f"{endpoint_name} is not mounted")


def _dependency_calls(route) -> set[str]:
    """Every dependency function a route ends up running, nested ones included."""
    names: set[str] = set()

    def walk(dependant):
        for sub in dependant.dependencies:
            if sub.call is not None:
                names.add(sub.call.__name__)
            walk(sub)

    walk(route.dependant)
    return names


def test_the_crisis_detector_is_not_an_http_endpoint():
    """It returns the matched keyword and category, so a public copy is the
    keyword dictionary itself — and with it a message that passes Layer 1."""
    assert not [p for p in app.openapi()["paths"] if "crisis" in p]


def test_the_chat_path_still_has_its_detector():
    """Unmounting the router must not take the in-process detector with it."""
    from duyo.crisis.router import get_detector

    assert get_detector().check("salom") is not None


def test_docs_and_the_route_map_are_off_in_production(in_production):
    production_app = create_app()
    assert production_app.docs_url is None
    assert production_app.redoc_url is None
    assert production_app.openapi_url is None


def test_docs_stay_on_everywhere_else():
    assert create_app().docs_url == "/docs"


def test_the_mock_subscription_does_not_exist_in_production(in_production):
    """It grants a paid tier with no charge, to any authenticated caller."""
    with pytest.raises(HTTPException) as exc:
        # asyncio.run, not get_event_loop(): which loop is "current" in a sync
        # test is decided by whatever ran before it.
        asyncio.run(
            subscription_module.subscribe(
                payload=SubscribeRequest(tier="premium", period="yearly", provider="mock"),
                current_user=None,
                db=None,
            )
        )
    assert exc.value.status_code == 404


@pytest.mark.parametrize(
    "endpoint",
    ["list_review_queue", "approve_chunk", "reject_chunk", "get_stats"],
)
def test_the_textbook_admin_routes_want_an_admin(endpoint):
    """They said "(admin)" and took an ordinary family token; /reject deletes
    a chunk of the corpus every homework answer is grounded in."""
    calls = _dependency_calls(_route(endpoint))
    assert "get_current_admin" in calls
    assert "get_current_user" not in calls


def test_textbook_search_stays_open_to_families():
    assert "get_current_user" in _dependency_calls(_route("search_textbook"))
