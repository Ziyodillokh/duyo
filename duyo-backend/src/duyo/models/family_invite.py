"""FamilyInvite — a parent's pending invitation for their child to link a
second, independent account.

Created when a parent enters their child's phone number during onboarding
(replacing the old "how old are you" step, which now belongs to the child).

An invite is an OFFER, never a link. It is claimed only when the person
holding that phone signs in and EXPLICITLY accepts it (POST /family/invite/
accept). That consent step is the whole security model of this table:

  `child_phone` is an arbitrary number typed by whoever is inviting. Nothing
  proves they know its owner. An earlier version claimed the invite
  automatically on the invitee's next OTP verify, which meant any account
  could type a stranger's number and — with no signal to that stranger
  beyond an ordinary-looking login SMS — silently become the "parent" of
  their profile: reading their chat history and safety reports, and
  receiving the crisis alerts that should have gone to the real parent. A
  single mistyped digit produced the same result by accident.

So: only the invitee can turn an offer into a link, they are shown who is
asking before they decide, offers expire, and a declined offer is dead.
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from duyo.models.base import UUIDPK, Base, TimestampMixin

#: How long an offer stands. Long enough for a child to get home and open
#: the app, short enough that a recycled or mistyped number is not still
#: carrying someone's pending claim months later.
INVITE_TTL = timedelta(hours=24)


def default_expiry() -> datetime:
    return datetime.now(UTC) + INVITE_TTL


class FamilyInvite(Base, UUIDPK, TimestampMixin):
    __tablename__ = "family_invites"

    parent_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    child_name: Mapped[str] = mapped_column(String(80), nullable=False)
    child_phone: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=default_expiry,
    )
    claimed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    claimed_by_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    #: Set when the invitee refused. A declined offer is never re-offered.
    declined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def is_open(self, *, now: datetime | None = None) -> bool:
        """Still awaiting a decision — not accepted, not refused, not stale."""
        now = now or datetime.now(UTC)
        expires = self.expires_at
        if expires is not None and expires.tzinfo is None:
            expires = expires.replace(tzinfo=UTC)
        return (
            not self.claimed
            and self.declined_at is None
            and (expires is None or expires > now)
        )

    def __repr__(self) -> str:
        return f"<FamilyInvite parent={self.parent_id} child_phone={self.child_phone} claimed={self.claimed}>"
