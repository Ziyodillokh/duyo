"""User (ota-ona) — phone-based auth account."""

from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from duyo.models.base import UUIDPK, Base, TimestampMixin


class AccountRole(str, Enum):
    """Who is holding the phone — the answer the first onboarding screen asks."""

    PARENT = "parent"
    CHILD = "child"


# create_type=False — the migration owns the PG type (repo convention).
_account_role_enum = ENUM(
    AccountRole,
    name="account_role",
    create_type=False,
    values_callable=lambda enum_cls: [e.value for e in enum_cls],
)


class User(Base, UUIDPK, TimestampMixin):
    __tablename__ = "users"

    # E.164 normalised phone (e.g. +998901234567). Single auth identity.
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Nullable: accounts created before this existed have no answer, and
    # guessing one would be worse than an honest blank.
    role: Mapped[AccountRole | None] = mapped_column(_account_role_enum, nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(80), nullable=True)

    children: Mapped[list["ChildProfile"]] = relationship(  # noqa: F821
        back_populates="parent",
        foreign_keys="ChildProfile.parent_id",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} phone={self.phone}>"
