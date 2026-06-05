"""Gamification request/response schemas — avatar, balls, inventory, streak."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

# Validation vocabularies (Concept §3.2) — named option keys shared 1:1 with
# the mobile avatar customizer. Accent is a wearable accessory, not a colour.
BodyShape = Literal["sphere", "cube", "vertical", "mini"]
PrimaryColor = Literal["blue", "purple", "green", "red"]
Accent = Literal["none", "star", "cap", "glasses"]
FaceStyle = Literal["smile", "curious", "sunny", "wink"]


# ── Avatar ───────────────────────────────────────────────────────────────────

class AvatarRead(BaseModel):
    body_shape: str
    primary_color: str
    accent: str
    face_style: str

    model_config = {"from_attributes": True}


class AvatarUpdate(BaseModel):
    """Partial update — only provided fields change."""

    body_shape: BodyShape | None = None
    primary_color: PrimaryColor | None = None
    accent: Accent | None = None
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


class AchievementRead(BaseModel):
    key: str
    name: str
    emoji: str
    earned: bool
