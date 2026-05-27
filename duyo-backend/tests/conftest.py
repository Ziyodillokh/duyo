"""Shared pytest fixtures."""

import os

import pytest

os.environ.setdefault("APP_SECRET_KEY", "test-secret-key-for-pytest-only-not-real")
os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("APP_DEBUG", "true")


@pytest.fixture
def detector():
    """Fresh KeywordCrisisDetector — module is stateless so this is cheap."""
    from duyo.crisis.detector import KeywordCrisisDetector
    return KeywordCrisisDetector()
