"""Production misconfiguration guards — and where they are allowed to fire.

The SMS check exists because StubSMSProvider.send() returns True: with the
stub on, logins hand out codes nobody receives and crisis alerts are recorded
as delivered while reaching no parent. The failure has no symptom, so startup
says so loudly.

WHERE it fires matters as much as that it fires, and both stricter forms of
this check caused their own outage:

  * As a @model_validator it ran wherever Settings is built — including
    `migrations/env.py`, which the deploy runs with an env file that does not
    carry ESKIZ_*. It aborted the migration and failed the whole deploy.
  * Raised at startup, it failed the deploy's health gate on a box already
    misconfigured, rolling back every release — including the one closing a
    family-linking security hole.

So it is a plain query the app logs on, never a validator and never fatal.
These tests pin the query itself; making it fatal again is safe only once the
production environment is known good.

`_env_file=None` throughout — without it pydantic-settings reads the
developer's own .env and the assertions below test that file, not the code.
"""

from __future__ import annotations

import pytest

from duyo.core.config import Settings

BASE = {"app_secret_key": "x" * 32, "_env_file": None}


def _settings(**overrides) -> Settings:
    return Settings(**{**BASE, **overrides})  # type: ignore[arg-type]


# ── the guard must not block anything that merely reads config ──────────────

def test_production_without_eskiz_credentials_still_constructs():
    """migrations/env.py builds Settings; raising here breaks the deploy."""
    s = _settings(app_env="production")
    assert s.app_env == "production"


def test_production_with_stub_on_still_constructs():
    s = _settings(app_env="production", sms_stub_enabled=True)
    assert s.sms_stub_enabled is True


# ── but it must still catch the misconfiguration ────────────────────────────

def test_stub_left_on_in_production_is_flagged():
    s = _settings(
        app_env="production", sms_stub_enabled=True,
        eskiz_email="a@b.c", eskiz_password="k",
    )
    assert "SMS_STUB_ENABLED" in (s.sms_misconfigured_for_production() or "")


def test_missing_credentials_in_production_are_flagged():
    s = _settings(app_env="production", sms_stub_enabled=False)
    assert "ESKIZ_EMAIL" in (s.sms_misconfigured_for_production() or "")


@pytest.mark.parametrize("missing", ["eskiz_email", "eskiz_password"])
def test_either_credential_alone_is_not_enough(missing):
    creds = {"eskiz_email": "a@b.c", "eskiz_password": "k"}
    creds[missing] = ""
    s = _settings(app_env="production", sms_stub_enabled=False, **creds)
    assert s.sms_misconfigured_for_production() is not None


def test_a_correctly_configured_production_passes():
    s = _settings(
        app_env="production", sms_stub_enabled=False,
        eskiz_email="a@b.c", eskiz_password="k",
    )
    assert s.sms_misconfigured_for_production() is None


@pytest.mark.parametrize("env", ["development", "staging"])
def test_non_production_is_never_blocked(env):
    """The stub is the point outside production."""
    s = _settings(app_env=env, sms_stub_enabled=True)
    assert s.sms_misconfigured_for_production() is None


# ── the demo-code guard IS a validator, deliberately ────────────────────────

def test_demo_otp_code_still_refuses_to_build_in_production():
    """Unlike the SMS guard this one is safe as a validator: it only fires
    when OTP_DEMO_CODE is explicitly set, which no deploy path does."""
    with pytest.raises(ValueError, match="OTP_DEMO_CODE"):
        _settings(app_env="production", otp_demo_code="00000")


def test_demo_otp_code_is_allowed_with_the_explicit_second_switch():
    s = _settings(
        app_env="production", otp_demo_code="00000",
        otp_demo_allow_in_production=True,
    )
    assert s.otp_demo_code == "00000"
