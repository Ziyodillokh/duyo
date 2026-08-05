"""Schemas for the signed-in account (GET/PATCH /v1/me)."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, Field

from duyo.models.user import AccountRole


class AccountUpdate(BaseModel):
    """Every field optional — absent means "leave as is", never "clear"."""

    role: AccountRole | None = None
    display_name: Annotated[str, Field(max_length=80)] | None = None


class AccountRead(BaseModel):
    id: UUID
    phone: str
    role: AccountRole | None
    display_name: str | None
    created_at: datetime
    last_login_at: datetime | None
    # Lets the app decide between "resume" and "onboard" without a second call.
    children_count: int

    model_config = {"from_attributes": True}
