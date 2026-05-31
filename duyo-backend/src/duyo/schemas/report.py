"""Parent report response schemas (Concept §11)."""

from datetime import datetime

from pydantic import BaseModel


class ActivitySection(BaseModel):
    active_days: int
    total_messages: int
    conversations: int
    window_days: int


class MoodSection(BaseModel):
    mood_trend: str
    mood_summary: str
    topics: list[str]
    stress_signals: str
    highlight: str


class SafetySection(BaseModel):
    by_level: dict[str, int]
    concerning_count: int
    had_red: bool


class ReportSections(BaseModel):
    activity: ActivitySection
    mood: MoodSection
    safety: SafetySection


class ReportRead(BaseModel):
    child_id: object  # UUID serialised by FastAPI
    period_start: datetime
    period_end: datetime
    llm_ok: bool
    cached: bool
    sections: ReportSections
