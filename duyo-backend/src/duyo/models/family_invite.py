"""FamilyInvite — a parent's pending invitation for their child to link a
second, independent account.

Created when a parent enters their child's phone number during onboarding
(replacing the old "how old are you" step, which now belongs to the child).
Claimed automatically the moment that phone number completes an ordinary OTP
login (see api/v1/auth.verify_otp) — no separate "enter this code" screen or
code storage of its own; the invite just watches for the child's normal
login and, when it sees one on the phone it's waiting for, hands
`create_child` the inviting parent's id instead of the child's own.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from duyo.models.base import UUIDPK, Base, TimestampMixin


class FamilyInvite(Base, UUIDPK, TimestampMixin):
    __tablename__ = "family_invites"

    parent_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    child_name: Mapped[str] = mapped_column(String(80), nullable=False)
    child_phone: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    claimed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    claimed_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<FamilyInvite parent={self.parent_id} child_phone={self.child_phone} claimed={self.claimed}>"
