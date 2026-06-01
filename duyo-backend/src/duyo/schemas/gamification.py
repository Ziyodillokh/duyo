"""Gamification request/response schemas — avatar, balls, inventory, streak."""

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field

# Validation vocabularies (Concept §3.2). Kept permissive but bounded.
_HEX = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
BodyShape = Literal["spherical", "cubic", "vertical"]
FaceStyle = Literal["friendly", "curious", "calm", "playful", "wise"]


# ── Avatar ───────────────────────────────────────────────────────────────────

class AvatarRead(BaseModel):
    body_shape: str
    primary_color: str
    accent_color: str
    face_style: str

    model_config = {"from_attributes": True}


class AvatarUpdate(BaseModel):
    """Partial update — only provided fields change."""

    body_shape: BodyShape | None = None
    primary_color: Annotated[str, _HEX] | None = None
    accent_color: Annotated[str, _HEX] | None = None
    face_style: FaceStyle | None = None


# ── Balls (XP) ───────────────────────────────────────────────────────────────

class BallsBalance(BaseModel):
    balance: int
    level: int
    level_name: str
    current_threshold: int
    next_threshold: int | None
    balls_to_next: int | None


class BallsAward(BaseModel):
    amount: int = Field(gt=0, le=1000, description="Balls to add (positive)")
    reason: str = Field(min_length=1, max_length=50)


class BallsSpend(BaseModel):
    amount: int = Field(gt=0, le=100000, description="Balls to deduct (positive)")
    reason: str = Field(min_length=1, max_length=50)


class BallsTransactionRead(BaseModel):
    amount: int
    reason: str
    balance_after: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Inventory ────────────────────────────────────────────────────────────────

class InventoryItemRead(BaseModel):
    item_key: str
    category: str
    created_at: datetime

    model_config = {"from_attributes": True}


class InventoryPurchase(BaseModel):
    item_key: str = Field(min_length=1, max_length=60)
    category: str = Field(min_length=1, max_length=30)
    cost: int = Field(ge=0, le=100000, description="Ball cost of the item")


# ── Streak ───────────────────────────────────────────────────────────────────

class StreakRead(BaseModel):
    current_streak: int
    longest_streak: int
    last_active_date: date | None

    model_config = {"from_attributes": True}
