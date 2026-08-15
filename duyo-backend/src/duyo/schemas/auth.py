"""Auth-related request/response schemas."""

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


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # access token TTL in seconds
    # Set only on the verify call that claims a parent's pending FamilyInvite
    # for this phone — tells the client to skip re-asking the child's name
    # (the parent already gave it) and go straight to the rest of onboarding.
    linked_child_name: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str
