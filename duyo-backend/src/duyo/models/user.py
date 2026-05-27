"""User (ota-ona) — phone-based auth account."""

from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from duyo.models.base import Base, TimestampMixin, UUIDPK


class User(Base, UUIDPK, TimestampMixin):
    __tablename__ = "users"

    # E.164 normalised phone (e.g. +998901234567). Single auth identity.
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    children: Mapped[list["ChildProfile"]] = relationship(  # noqa: F821
        back_populates="parent",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} phone={self.phone}>"
