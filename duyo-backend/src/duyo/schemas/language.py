"""Language-practice exercise schemas (mirrors dtm.py's shape)."""

from typing import Literal

from pydantic import BaseModel, Field

from duyo.models.child import AgeSegment


class LanguageQuestion(BaseModel):
    text: str
    choices: list[str]
    correct_index: int
    explanation: str = ""


class LanguagePracticeRequest(BaseModel):
    language: Literal["ru", "en"]
    age_segment: AgeSegment
    topic: str | None = Field(default=None, max_length=60)
    count: int = Field(default=5, ge=1, le=10)


class LanguagePracticeResponse(BaseModel):
    questions: list[LanguageQuestion]
