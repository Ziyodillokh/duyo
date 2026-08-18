"""Goal schemas.

`source` is deliberately narrowed on create: only the extractor may write
`inferred`, so a client cannot pass off a guess as something the child said —
and only confirmed goals ever reach the system prompt.
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from duyo.models.goal import GoalKind, GoalSource, GoalStatus


class GoalCreate(BaseModel):
    kind: GoalKind = GoalKind.OTHER
    title: str = Field(min_length=2, max_length=160)
    match_key: str | None = Field(default=None, max_length=80)
    target_ref: dict | None = None
    unit_label: str | None = Field(default=None, max_length=24)
    total_units: int | None = Field(default=None, ge=1, le=100_000)
    target_date: datetime | None = None
    # `inferred` is intentionally absent — see module docstring.
    source: Literal["child_stated", "parent_set", "onboarding"] = "child_stated"


class GoalUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=160)
    status: GoalStatus | None = None
    unit_label: str | None = Field(default=None, max_length=24)
    total_units: int | None = Field(default=None, ge=1, le=100_000)
    target_date: datetime | None = None


class GoalProgressCreate(BaseModel):
    unit_value: int = Field(ge=0, le=100_000)
    note: str | None = Field(default=None, max_length=280)
    # Progress normally only moves forward; going backwards is almost always a
    # mistyped page number, so it must be asked for explicitly.
    allow_regress: bool = False


class GoalEventRead(BaseModel):
    id: UUID
    unit_value: int | None
    note: str | None
    source: GoalSource
    created_at: datetime

    model_config = {"from_attributes": True}


class GoalRead(BaseModel):
    id: UUID
    child_id: UUID
    kind: GoalKind
    title: str
    match_key: str | None
    target_ref: dict | None
    status: GoalStatus
    source: GoalSource
    confirmed_at: datetime | None
    unit_label: str | None
    current_unit: int | None
    total_units: int | None
    progress_pct: float | None
    last_progress_at: datetime | None
    target_date: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class GoalCatalogRead(BaseModel):
    match_key: str
    kind: GoalKind
    title: str
    target_ref: dict | None
    # The band this goal is published for. The picker filters server-side by
    # the child's age, so a client should never see an entry it may not pick —
    # but the band is returned anyway so the app can SAY "12-16" on a chip.
    age_min: int
    age_max: int

    model_config = {"from_attributes": True}


class GoalSignalRead(BaseModel):
    """How many other children share this goal — a count, never an identity.

    Suppressed below a floor so a count can never de-anonymise one child.
    """

    match_key: str
    title: str
    count: int
