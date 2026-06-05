"""DTM practice question schemas."""

from pydantic import BaseModel, Field


class DtmQuestion(BaseModel):
    text: str
    choices: list[str]
    correct_index: int
    explanation: str = ""


class DtmRequest(BaseModel):
    subject: str = Field(min_length=1, max_length=60)
    count: int = Field(default=5, ge=1, le=10)


class DtmResponse(BaseModel):
    questions: list[DtmQuestion]
