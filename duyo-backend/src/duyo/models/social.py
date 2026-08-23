"""Goal-mates: children working toward the same thing, and the channel between them.

This is the highest-risk surface in the product — it connects children to
children. The safety properties are structural, not policy notes:

- **Pseudonymous.** A peer only ever sees `display_name` (system-issued, e.g.
  "Yulduz-73") and an age band. `ChildProfile.name` is a real given name a
  parent typed at onboarding and must never cross to a peer.
- **Server-relayed.** Every message is persisted and scanned before delivery.
  No peer-to-peer path exists, which is also what makes retraction possible.
- **Canonically ordered pairs.** `friendships` stores (low, high) with a CHECK,
  so holding both (A,B) and (B,A) is structurally impossible — no duplicate
  request race, and blocking is inherently bilateral.
- **Evidence survives.** `sender_child_id` is ON DELETE SET NULL, not CASCADE:
  deleting a profile must not erase the other child's thread or the record of
  what was said. Precedent: crisis_events.message_id.
- **Separate from `messages`.** Peer chat must not flow into the parent report
  built by analysis/reports.py.
"""

from datetime import datetime
from enum import Enum
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column

from duyo.models.base import UUIDPK, Base, TimestampMixin


class FriendshipStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    BLOCKED = "blocked"


class PeerModerationState(str, Enum):
    DELIVERED = "delivered"
    BLOCKED = "blocked"    # never shown to the recipient
    REDACTED = "redacted"  # delivered, then pulled after a deeper check


def _enum(enum_cls: type[Enum], name: str) -> ENUM:
    return ENUM(
        enum_cls,
        name=name,
        create_type=False,
        values_callable=lambda cls: [e.value for e in cls],
    )


_friendship_status_enum = _enum(FriendshipStatus, "friendship_status")
_peer_moderation_enum = _enum(PeerModerationState, "peer_moderation_state")


class ChildSocialSettings(Base, UUIDPK, TimestampMixin):
    """Per-child social state. An ABSENT row means social is fully off.

    Failing closed matters here: a bug that skips creating this row must make a
    child invisible, never accidentally discoverable.
    """

    __tablename__ = "child_social_settings"
    __table_args__ = (
        UniqueConstraint("child_id", name="uq_social_settings_child"),
    )

    child_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    # System-issued, chosen from a curated list. Never free-typed: a free-text
    # handle is both a PII channel and an abuse channel that would bypass
    # message moderation entirely.
    display_name: Mapped[str] = mapped_column(String(24), nullable=False)
    discoverable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Safety-officer kill switch, independent of the child's own setting.
    suspended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    suspended_by: Mapped[str | None] = mapped_column(String(255), nullable=True)

    def __repr__(self) -> str:
        return f"<ChildSocialSettings {self.display_name} discoverable={self.discoverable}>"


class Friendship(Base, UUIDPK, TimestampMixin):
    __tablename__ = "friendships"
    __table_args__ = (
        CheckConstraint("child_low_id < child_high_id", name="ck_friendship_ordered_pair"),
        UniqueConstraint("child_low_id", "child_high_id", name="uq_friendship_pair"),
    )

    # Canonical order — see module docstring.
    child_low_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    child_high_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    requested_by_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False,
    )
    status: Mapped[FriendshipStatus] = mapped_column(
        _friendship_status_enum, nullable=False, default=FriendshipStatus.PENDING
    )
    blocked_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="SET NULL"), nullable=True,
    )
    # What brought them together — shown as context, and the audit trail for
    # "why was my child introduced to this one".
    match_key: Mapped[str | None] = mapped_column(String(80), nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def other_id(self, me: UUID) -> UUID:
        return self.child_high_id if me == self.child_low_id else self.child_low_id

    def __repr__(self) -> str:
        return f"<Friendship {self.child_low_id}~{self.child_high_id} {self.status.value}>"


class PeerMessage(Base, UUIDPK, TimestampMixin):
    """One message between two children. Persisted BEFORE delivery, always."""

    __tablename__ = "peer_messages"
    __table_args__ = (
        Index("ix_peer_messages_friendship_seq", "friendship_id", "seq"),
    )

    friendship_id: Mapped[UUID] = mapped_column(
        ForeignKey("friendships.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    # SET NULL, not CASCADE — see module docstring.
    sender_child_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    # Monotonic per-table cursor. UUIDs are not orderable and created_at ties,
    # so this is what the client pages on.
    #
    # Identity(), not autoincrement=True: on a non-primary-key column
    # autoincrement is a no-op for SQLAlchemy's INSERT builder, so it sent an
    # explicit NULL and every message 500'd on the NOT NULL constraint. The
    # migration already declares GENERATED BY DEFAULT AS IDENTITY; this is what
    # tells the ORM to leave the column out and read the generated value back.
    seq: Mapped[int] = mapped_column(
        BigInteger, Identity(always=False), nullable=False, unique=True,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    moderation_state: Mapped[PeerModerationState] = mapped_column(
        _peer_moderation_enum, nullable=False, default=PeerModerationState.DELIVERED
    )
    # Why it was blocked/redacted — kept for the safety queue, never shown.
    moderation_reason: Mapped[str | None] = mapped_column(String(80), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Set when a safety admin has worked this row in the peer-flag queue.
    # Mirrors CrisisEvent so both queues behave identically.
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reviewed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)

    def __repr__(self) -> str:
        return f"<PeerMessage seq={self.seq} {self.moderation_state.value}>"


class GroupMessage(Base, UUIDPK, TimestampMixin):
    """One message in a goal group — the same contract as PeerMessage.

    Groups have no membership table on purpose. A child belongs to a group
    exactly while they hold a CONFIRMED, matchable goal in that category and
    are discoverable; leaving is therefore the same act as retiring the goal
    or turning visibility off, and there is no second consent surface to get
    out of step with the first.

    `group_key` is category + age segment ("it:explorer"). Segments never
    share a room: a nine-year-old and a fifteen-year-old having a goal in
    common is not a reason to put them in the same conversation.
    """

    __tablename__ = "group_messages"
    __table_args__ = (
        Index("ix_group_messages_key_seq", "group_key", "seq"),
    )

    #: "<category>:<age_segment>", e.g. "kitoblar:explorer".
    group_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # SET NULL, not CASCADE — a deleted child must not erase the safety record
    # of what was said in a room full of other children.
    sender_child_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="SET NULL"), nullable=True, index=True,
    )
    #: The pseudonym as it stood when the message was sent, so history does not
    #: silently rewrite itself when a child renames.
    sender_name: Mapped[str] = mapped_column(String(40), nullable=False)
    # See PeerMessage.seq for why Identity() rather than autoincrement.
    seq: Mapped[int] = mapped_column(
        BigInteger, Identity(always=False), nullable=False, unique=True,
    )
    #: For a voice or video note this holds the TRANSCRIPT, not a caption. The
    #: transcript is what the text screen actually judged, so storing it keeps
    #: the moderation decision auditable — and it doubles as the caption a
    #: child who cannot play the clip still gets to read.
    body: Mapped[str] = mapped_column(Text, nullable=False)

    #: Object-storage key for a voice/video note; NULL for a plain text
    #: message. The key, never a URL — the bucket is private and the API
    #: serves it, so a moved bucket does not rewrite history.
    media_key: Mapped[str | None] = mapped_column(String(120), nullable=True)
    #: "audio" or "video". A plain string rather than an enum: this is a
    #: presentation hint, and a new kind should not need a type migration.
    media_kind: Mapped[str | None] = mapped_column(String(16), nullable=True)
    #: Milliseconds, so the bubble can draw the duration before the file loads.
    media_duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    moderation_state: Mapped[PeerModerationState] = mapped_column(
        _peer_moderation_enum, nullable=False, default=PeerModerationState.DELIVERED
    )
    moderation_reason: Mapped[str | None] = mapped_column(String(80), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reviewed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)

    def __repr__(self) -> str:
        return f"<GroupMessage {self.group_key} seq={self.seq}>"


class PeerReport(Base, UUIDPK, TimestampMixin):
    """A child reporting another. Never requires an explanation to file."""

    __tablename__ = "peer_reports"

    reporter_child_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    reported_child_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    friendship_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("friendships.id", ondelete="SET NULL"), nullable=True,
    )
    reason: Mapped[str | None] = mapped_column(String(200), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True,
    )
    reviewed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)

    def __repr__(self) -> str:
        return f"<PeerReport {self.reporter_child_id}→{self.reported_child_id}>"
