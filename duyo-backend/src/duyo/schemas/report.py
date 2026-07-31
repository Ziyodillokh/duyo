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


class GuidanceSection(BaseModel):
    tips: list[str]
    focus: str


class CognitiveSection(BaseModel):
    """Developmental observation — NOT a clinical or psychometric score."""

    vocabulary_level: str = ""
    curiosity_signals: list[str] = []
    note: str = ""


class ReportSections(BaseModel):
    activity: ActivitySection
    mood: MoodSection
    safety: SafetySection
    # Optional: older cached reports (pre-guidance) won't have this section.
    guidance: GuidanceSection | None = None
    # Optional: reports cached before the cognitive pass won't have it either.
    cognitive: CognitiveSection | None = None


class ReportRead(BaseModel):
    child_id: object  # UUID serialised by FastAPI
    period_start: datetime
    period_end: datetime
    llm_ok: bool
    cached: bool
    sections: ReportSections


class TrendPoint(BaseModel):
    """One past report reduced to the few numbers worth plotting over time."""

    period_end: datetime
    active_days: int
    total_messages: int
    concerning_count: int
    mood_trend: str
    vocabulary_level: str


class TrendsRead(BaseModel):
    child_id: object  # UUID serialised by FastAPI
    points: list[TrendPoint]  # oldest → newest
