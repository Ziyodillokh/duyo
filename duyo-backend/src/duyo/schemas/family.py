"""Family linking — parent invites their child's own phone to join the account."""

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from duyo.schemas.auth import normalize_uz_phone


class FamilyInviteCreate(BaseModel):
    child_name: str = Field(min_length=1, max_length=80)
    child_phone: str = Field(min_length=9, max_length=20)

    @field_validator("child_name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Name cannot be blank")
        return stripped

    @field_validator("child_phone")
    @classmethod
    def _normalize(cls, v: str) -> str:
        return normalize_uz_phone(v)


class FamilyInviteRead(BaseModel):
    child_name: str
    child_phone: str
    claimed: bool
    claimed_at: datetime | None

    model_config = {"from_attributes": True}
