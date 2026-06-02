"""Content library — poems/stories/lessons/audio managed via admin panel.

Publish gate (admin-panel spec): an item can be `published` only when both
`license_status` and `review_status` are APPROVED — enforced at the API layer.
"""

from enum import Enum

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column

from duyo.models.base import UUIDPK, Base, TimestampMixin


class ContentType(str, Enum):
    POEM = "poem"
    STORY = "story"
    LESSON = "lesson"      # Darslar / darslik
    AUDIO = "audio"
    LANGUAGE = "language"  # Til
    DTM = "dtm"            # DTM / IELTS test
    PDF = "pdf"            # PDF hujjat asosiy kontent
    PHOTO = "photo"        # fotomaterial asosiy kontent


class ReviewStatus(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class LicenseStatus(str, Enum):
    UNKNOWN = "unknown"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


def _enum(enum_cls, name):
    return ENUM(enum_cls, name=name, create_type=False, values_callable=lambda e: [m.value for m in e])


class ContentItem(Base, UUIDPK, TimestampMixin):
    __tablename__ = "content_items"

    type: Mapped[ContentType] = mapped_column(_enum(ContentType, "content_type"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    age_segment: Mapped[str] = mapped_column(String(20), nullable=False, default="all")  # junior/explorer/companion/all
    language: Mapped[str] = mapped_column(String(5), nullable=False, default="uz")
    audio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)  # cover / fotomaterial
    pdf_url: Mapped[str | None] = mapped_column(String(500), nullable=True)     # hujjat / asosiy PDF
    author: Mapped[str | None] = mapped_column(String(120), nullable=True)

    review_status: Mapped[ReviewStatus] = mapped_column(
        _enum(ReviewStatus, "content_review_status"), nullable=False, default=ReviewStatus.DRAFT
    )
    license_status: Mapped[LicenseStatus] = mapped_column(
        _enum(LicenseStatus, "content_license_status"), nullable=False, default=LicenseStatus.PENDING
    )
    published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    completions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    likes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reports: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    def __repr__(self) -> str:
        return f"<ContentItem {self.type.value}:{self.title!r} published={self.published}>"
