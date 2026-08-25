"""Chat-related schemas."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from duyo.models.child import AgeSegment, Language
from duyo.models.crisis_event import CrisisLevel


class SourceRef(BaseModel):
    title: str
    url: str | None = None


class ChatSource(BaseModel):
    type: Literal["textbook", "web", "none"]
    label: str
    refs: list[SourceRef] = []


class ChatImage(BaseModel):
    url: str                 # display URL (safe to load directly)
    title: str
    source_url: str          # tap-through page for attribution / context
    creator: str | None = None
    license: str | None = None


class QuickReply(BaseModel):
    label: str
    action: Literal["web_search", "dismiss"]
    query: str | None = None


# Interests are free text chosen from a fixed list in the app; cap both the
# count and the length so a malformed client cannot write an essay per child.
MAX_INTERESTS = 12
_Interest = Annotated[str, Field(min_length=1, max_length=40)]


class ChildCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    age: int = Field(ge=7, le=16)
    language: Language = Language.UZ
    interests: list[_Interest] = Field(default_factory=list, max_length=MAX_INTERESTS)
    mascot: Annotated[str, Field(max_length=32)] | None = None

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        """A name of spaces is not a name."""
        stripped = v.strip()
        if not stripped:
            raise ValueError("Name cannot be blank")
        return stripped


class ChildUpdate(BaseModel):
    """Partial update — all fields optional. Age change re-derives age_segment.

    Annotated[...] | None is required so the 7-16 bound is enforced on the int
    branch of the union; `int | None = Field(ge=...)` silently drops the
    constraint in pydantic 2.12.
    """

    name: Annotated[str, Field(min_length=1, max_length=80)] | None = None
    age: Annotated[int, Field(ge=7, le=16)] | None = None
    language: Language | None = None
    interests: Annotated[list[_Interest], Field(max_length=MAX_INTERESTS)] | None = None
    mascot: Annotated[str, Field(max_length=32)] | None = None


class ChildRead(BaseModel):
    id: UUID
    name: str
    age: int
    age_segment: AgeSegment
    language: Language
    interests: list[str] = []
    mascot: str | None = None
    # Filled from ChildProfile.photo_url, which is a property rather than a
    # column: the routes return the ORM object and let from_attributes do
    # the rest, so this arrives without any route remembering to set it.
    photo_url: str | None = None

    model_config = {"from_attributes": True}


# Local-first personal memory (see duyo-mobile/src/lib/memory-*.ts and
# duyo/services/memory_candidates.py). "goals" is deliberately not a memory
# category — GoalCreate/INSIGHT_EXTRACT_PROMPT already own that shape of fact.
MemoryCategory = Literal[
    "profile", "preferences", "interests", "learning", "research", "notes"
]

#: Cap on how many locally-selected memory snippets one request may carry —
#: the device already narrowed 100s of memories down to "relevant ones"; a
#: cap here is a second backstop against a buggy client sending everything.
MAX_MEMORY_CONTEXT_ITEMS = 6
_MemoryContextLine = Annotated[str, Field(max_length=240)]


class MemoryCandidateRead(BaseModel):
    """The extractor's suggestion for this turn only — never persisted here.

    The device runs its own Memory Guard against this before ever offering
    the child a consent prompt; a category/content pair reaching this schema
    is not itself a save.
    """

    category: MemoryCategory
    content: str


class ChatRequest(BaseModel):
    child_id: UUID
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: UUID | None = None  # null → create new conversation
    #: Files a NEW conversation into a project as it is created, so a chat
    #: started from inside a project belongs to it from its first message and
    #: picks up the project's standing instructions immediately. Ignored when
    #: `conversation_id` names an existing conversation — that one already has
    #: a project, and moving it is what PATCH is for.
    project_id: UUID | None = None
    action: Literal["web_search"] | None = None
    action_query: str | None = Field(default=None, max_length=2000)
    # Short facts the DEVICE selected from the child's own encrypted local
    # memory as relevant to this message (see memory-retrieval.ts). Folded
    # into this one request's prompt and then discarded — the source of
    # truth stays on the child's device, never written to Postgres.
    memory_context: (
        Annotated[list[_MemoryContextLine], Field(max_length=MAX_MEMORY_CONTEXT_ITEMS)]
        | None
    ) = None


class ChatResponse(BaseModel):
    conversation_id: UUID
    message_id: UUID
    reply: str
    crisis_level: CrisisLevel
    model: str
    latency_ms: int
    source: ChatSource | None = None
    quick_replies: list[QuickReply] = []
    images: list[ChatImage] = []
    # Present only when this turn's message contained something worth
    # offering to remember. The app shows a consent prompt; nothing is saved
    # without it.
    memory_candidate: MemoryCandidateRead | None = None


class LessonHelpRequest(BaseModel):
    child_id: UUID
    subject: str = Field(min_length=1, max_length=40)
    question: str = Field(min_length=3, max_length=2000)


class LessonStep(BaseModel):
    title: str
    detail: str


class LessonHelpResponse(BaseModel):
    steps: list[LessonStep]
    answer: str
    #: False when `steps` is the outage notice rather than a real solution.
    #: The endpoint answers 200 either way (a child must never meet a 500),
    #: so this is the only thing that tells the two apart — without it the
    #: app renders an apology under a "DUYO yechimi" heading as if it had
    #: solved the problem.
    available: bool = True


class BoardRequest(BaseModel):
    """A single child utterance to consider writing on the chalkboard."""

    child_id: UUID
    question: str = Field(min_length=1, max_length=2000)


class BoardStep(BaseModel):
    expr: str   # one chalk line — the maths only
    note: str   # small caption under it, may be empty


class BoardFigureItem(BaseModel):
    """One primitive of a board diagram, in the problem's own coordinates.

    The client rescales everything to fit, so these are raw data values
    (e.g. a triangle with sides 6 and 4), not pixels.
    """

    type: Literal["curve", "shape", "circle", "arrow", "label"]
    points: list[list[float]] = []
    cx: float | None = None
    cy: float | None = None
    r: float | None = None
    label: str = ""


class BoardFigure(BaseModel):
    caption: str = ""
    axes: bool = False
    items: list[BoardFigureItem] = []


class BoardResponse(BaseModel):
    """is_problem=False means "not a solvable problem" — show no board."""

    is_problem: bool
    title: str = ""
    problem: str = ""
    steps: list[BoardStep] = []
    answer: str = ""
    figure: BoardFigure | None = None


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    target_lang: Literal["uz", "ru", "en"] = "uz"


class TranslateResponse(BaseModel):
    translated: str


class HintRequest(BaseModel):
    child_id: UUID
    context: str = Field(default="", max_length=2000)


class HintResponse(BaseModel):
    hint: str


class FeedbackRequest(BaseModel):
    child_id: UUID
    rating: Literal["up", "down"]
    reason: str | None = Field(default=None, max_length=200)


class FeedbackResponse(BaseModel):
    message_id: UUID
    rating: str
