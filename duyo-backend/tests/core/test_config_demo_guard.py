"""A login bypass must be chosen twice before it can reach production."""

import pytest
from pydantic import ValidationError

from duyo.core.config import Settings

BASE = {"app_secret_key": "x" * 32}


def test_demo_code_in_production_refuses_to_boot():
    with pytest.raises(ValidationError) as exc:
        Settings(**BASE, app_env="production", otp_demo_code="00000")
    assert "OTP_DEMO_CODE" in str(exc.value)


def test_demo_code_in_production_allowed_when_explicitly_accepted():
    settings = Settings(
        **BASE,
        app_env="production",
        otp_demo_code="00000",
        otp_demo_allow_in_production=True,
    )
    assert settings.otp_demo_code == "00000"


def test_demo_code_is_free_outside_production():
    for env in ("development", "staging"):
        settings = Settings(**BASE, app_env=env, otp_demo_code="00000")
        assert settings.otp_demo_code == "00000"


def test_production_without_demo_code_is_fine():
    settings = Settings(**BASE, app_env="production")
    assert settings.otp_demo_code == ""


def test_shipped_defaults_carry_no_bypass():
    """No fake account and no open code unless someone configures one."""
    settings = Settings(**BASE)
    assert settings.otp_demo_code == ""
    assert settings.otp_test_numbers == ""
