"""Gamification models — avatar, balls ledger, inventory, streak.

Concept §3 (avatar customisation) and §8 (ball/level/streak/inventory).
One small cohesive module: the four tables are always used together and
share the child_id foreign key.
"""

from datetime import date
from uuid import UUID

from sqlalchemy import Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from duyo.models.base import Base, TimestampMixin, UUIDPK


class Avatar(Base, UUIDPK, TimestampMixin):
    """DUYO appearance config — one per child (Concept §3.2)."""

    __tablename__ = "avatars"
    __table_args__ = (UniqueConstraint("child_id", name="uq_avatar_child"),)

    child_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    body_shape: Mapped[str] = mapped_column(String(20), nullable=False, default="spherical")
    primary_color: Mapped[str] = mapped_column(String(7), nullable=False, default="#4F8DFD")
    accent_color: Mapped[str] = mapped_column(String(7), nullable=False, default="#FFD166")
    face_style: Mapped[str] = mapped_column(String(20), nullable=False, default="friendly")


class BallsTransaction(Base, UUIDPK, TimestampMixin):
    """XP earn (+) / spend (-) ledger. Balance = SUM(amount) (Concept §8.1)."""

    __tablename__ = "balls_transactions"

    child_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(50), nullable=False)
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)


class InventoryItem(Base, UUIDPK, TimestampMixin):
    """An accessory/gadget a child has acquired (Concept §8.3)."""

    __tablename__ = "inventory_items"
    __table_args__ = (
        UniqueConstraint("child_id", "item_key", name="uq_inventory_child_item"),
    )

    child_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    item_key: Mapped[str] = mapped_column(String(60), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)


class Streak(Base, UUIDPK, TimestampMixin):
    """Daily-activity streak — one per child (Concept §8.4)."""

    __tablename__ = "streaks"
    __table_args__ = (UniqueConstraint("child_id", name="uq_streak_child"),)

    child_id: Mapped[UUID] = mapped_column(
        ForeignKey("child_profiles.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    current_streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_active_date: Mapped[date | None] = mapped_column(Date, nullable=True)
