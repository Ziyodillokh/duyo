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
            resp.raise_for_status()
            return resp.json().get("status") == "waiting"


def get_sms_provider() -> SMSProvider:
    settings = get_settings()
    if settings.sms_stub_enabled or not (settings.eskiz_email and settings.eskiz_password):
        return StubSMSProvider()
    return EskizSMSProvider(
        email=settings.eskiz_email,
        password=settings.eskiz_password,
        sender=settings.eskiz_from,
    )
