"""Tamagochi request/response schemas (Concept §4)."""

from typing import Literal

from pydantic import BaseModel, Field

# Which metric an interaction restores, and the allowed boost amount.
InteractionKind = Literal["check_in", "lesson", "play", "activity"]


class TamagochiRead(BaseModel):
    energy: int
    joy: int
    learning: int
    health: int

    model_config = {"from_attributes": True}


class TamagochiInteract(BaseModel):
    """A care interaction that restores one or more metrics (Concept §4.1).

    `kind` maps to the canonical restore (check_in→energy, lesson→learning,
    play→joy, activity→health). `amount` bounds how much a single interaction
    can add, so the client can't max out metrics in one call.
    """

    kind: InteractionKind
    amount: int = Field(default=10, ge=1, le=30)
