"""Auth-related request/response schemas."""

from datetime import datetime
from uuid import UUID

import phonenumbers
from phonenumbers import NumberParseException
from pydantic import BaseModel, Field, field_validator


def normalize_uz_phone(raw: str) -> str:
    """Parse and normalize an Uzbekistan phone to E.164 (+998XXXXXXXXX).

    Accepts: +998901234567, 998901234567, 901234567, +998 90 123 45 67
    """
    raw = raw.strip().replace(" ", "").replace("-", "")
    if raw.startswith("998") and not raw.startswith("+"):
        raw = "+" + raw
    if len(raw) == 9 and raw.isdigit():
        raw = "+998" + raw

    try:
        parsed = phonenumbers.parse(raw, "UZ")
    except NumberParseException as exc:
        raise ValueError(f"Invalid phone format: {exc}") from exc

    if not phonenumbers.is_valid_number(parsed):
        raise ValueError(f"Invalid phone number: {raw}")

    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)


class OTPRequest(BaseModel):
    phone: str = Field(min_length=9, max_length=20, description="UZ phone (any common format)")

    @field_validator("phone")
    @classmethod
    def _normalize(cls, v: str) -> str:
        return normalize_uz_phone(v)


class OTPVerify(BaseModel):
    phone: str
    code: str = Field(min_length=4, max_length=6)

    @field_validator("phone")
    @classmethod
    def _normalize(cls, v: str) -> str:
        return normalize_uz_phone(v)

    @field_validator("code")
    @classmethod
    def _digits_only(cls, v: str) -> str:
        """Reject non-digits at the door.

        secrets.compare_digest raises TypeError on non-ASCII input, so a code
        typed on a Cyrillic keyboard used to come back as a 500 instead of a
        plain "wrong code".
        """
        if not v.isdigit() or not v.isascii():
            raise ValueError("Code must be digits only")
        return v


class PendingFamilyInvite(BaseModel):
    """An OFFER awaiting this account's decision — NOT a link.

    Handed back at sign-in so the app can show who is asking before anything
    is connected. Nothing is linked until the invitee accepts; see
    models/family_invite.py for why that consent step exists.

    `from_phone` is the inviter's number, and is the point: it is how the
    invitee tells a parent they know from a stranger who typed their number.
    """

    id: UUID
    child_name: str
    from_phone: str
    expires_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # access token TTL in seconds
    # Someone has invited this phone into their family. Still just an offer:
    # the app must ask this user to accept before any link is formed.
    pending_family_invite: PendingFamilyInvite | None = None


class RefreshRequest(BaseModel):
    refresh_token: str
