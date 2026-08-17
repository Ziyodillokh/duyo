"""SMS sending — Eskiz.uz integration with dev-mode stub.

When `sms_stub_enabled=True` (default in development), SMS are logged
instead of sent. In production, Eskiz credentials are required and the
stub is disabled.

Eskiz API docs: https://documenter.getpostman.com/view/663428/RzfmES4z
"""

from __future__ import annotations

import logging
from typing import Protocol

import httpx

from duyo.core.config import get_settings

log = logging.getLogger(__name__)


class SMSNumberRejected(Exception):
    """Eskiz refused the destination itself ("Number is forbidden") — the
    number is not a real reachable subscriber. Distinct from a provider
    outage so callers can tell the user "check the number" instead of
    "try again later"."""


# ── Approved Eskiz templates ────────────────────────────────────────────────
#
# Eskiz delivers ONLY text that matches a template its moderators approved;
# anything else is rejected at send time and the SMS silently never arrives.
# For a crisis alert that is a child-safety failure nobody is told about, so
# these strings are the contract — not copy to be improved.
#
# Approved on account farzandimtech@gmail.com (%d = digits, %w{1,4} = 1-4 words):
#   83331  DUYO ilovasiga kirish uchun tasdiqlash kodi: %d (5 daqiqa amal qiladi.)
#   83332  DUYO XAVF: %w{1,4} bola jiddiy xavf signal berdi. Iltimos DARHOL
#          bog'laning. Ishonch telefon: 1142
#   83333  DUYO: %w{1,4} bola xabarida tashvishli signallar bor. 24 soat
#          ichida bola bilan suhbat o'tkazing.
#
# They live here, once, because they previously existed as copies in both
# chat.py and voice.py — and the ORANGE copy had drifted an extra
# "Maslahat: 1142" past the approved text, so every ORANGE parent alert was
# being rejected by Eskiz. tests/services/test_sms_templates.py pins each of
# these against the approved pattern so it cannot happen again.

OTP_TEMPLATE = "DUYO ilovasiga kirish uchun tasdiqlash kodi: {code} (5 daqiqa amal qiladi.)"

CRISIS_RED_TEMPLATE = (
    "DUYO XAVF: {name} bola jiddiy xavf signal berdi. "
    "Iltimos DARHOL bog'laning. Ishonch telefon: 1142"
)

CRISIS_ORANGE_TEMPLATE = (
    "DUYO: {name} bola xabarida tashvishli signallar bor. "
    "24 soat ichida bola bilan suhbat o'tkazing."
)

#: The %w{1,4} wildcard matches at most four whitespace-separated words. A
#: longer name would push the whole message off-template and get it rejected,
#: so it is clamped rather than allowed to fail the send.
_MAX_NAME_WORDS = 4


def _clamp_name(name: str) -> str:
    """First few words of a name, so it still fits the %w{1,4} wildcard."""
    words = (name or "").split()
    if not words:
        # An empty slot would collapse "DUYO:  bola" and miss the pattern.
        return "Farzandingiz"
    return " ".join(words[:_MAX_NAME_WORDS])


def otp_message(code: str) -> str:
    """The login/verification SMS body (Eskiz template 83331)."""
    return OTP_TEMPLATE.format(code=code)


def crisis_message(child_name: str, *, red: bool) -> str:
    """The parent crisis-alert body — RED (83332) or ORANGE (83333)."""
    template = CRISIS_RED_TEMPLATE if red else CRISIS_ORANGE_TEMPLATE
    return template.format(name=_clamp_name(child_name))


class SMSProvider(Protocol):
    async def send(self, phone: str, message: str) -> bool: ...


class StubSMSProvider:
    """Logs OTP/message instead of sending. Dev only."""

    async def send(self, phone: str, message: str) -> bool:
        log.warning("[SMS-STUB] phone=%s message=%r", phone, message)
        return True


class EskizSMSProvider:
    """Real Eskiz.uz HTTP API client."""

    BASE_URL = "https://notify.eskiz.uz/api"

    def __init__(self, email: str, password: str, sender: str = "DUYO") -> None:
        self._email = email
        self._password = password
        self._sender = sender
        self._token: str | None = None

    async def _login(self) -> str:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{self.BASE_URL}/auth/login",
                data={"email": self._email, "password": self._password},
            )
            resp.raise_for_status()
            self._token = resp.json()["data"]["token"]
            return self._token

    async def send(self, phone: str, message: str) -> bool:
        token = self._token or await self._login()
        # Eskiz uses E.164 without leading + (998XXXXXXXXX)
        eskiz_phone = phone.lstrip("+")
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{self.BASE_URL}/message/sms/send",
                headers={"Authorization": f"Bearer {token}"},
                data={"mobile_phone": eskiz_phone, "message": message, "from": self._sender},
            )
            if resp.status_code == 401:
                # Token expired — relogin once
                token = await self._login()
                resp = await client.post(
                    f"{self.BASE_URL}/message/sms/send",
                    headers={"Authorization": f"Bearer {token}"},
                    data={"mobile_phone": eskiz_phone, "message": message, "from": self._sender},
                )
            # A 400 here is Eskiz vetting the DESTINATION, not our request:
            # invalid, blocked or unallocated numbers come back as
            # {"message": "Number is forbidden"}. That is the caller's user
            # typing a wrong number, and must not surface as a 500.
            if resp.status_code == 400:
                try:
                    detail = str(resp.json().get("message", ""))
                except ValueError:
                    detail = resp.text
                if "forbidden" in detail.lower():
                    raise SMSNumberRejected(detail)
            resp.raise_for_status()
            # A 200 does not mean delivered: an off-template message comes
            # back with a non-"waiting" status. Callers MUST check this — see
            # the crisis dispatchers, which log a warning when it is False.
            return bool(resp.json().get("status") == "waiting")


def get_sms_provider() -> SMSProvider:
    settings = get_settings()
    if settings.sms_stub_enabled or not (settings.eskiz_email and settings.eskiz_password):
        return StubSMSProvider()
    return EskizSMSProvider(
        email=settings.eskiz_email,
        password=settings.eskiz_password,
        sender=settings.eskiz_from,
    )
