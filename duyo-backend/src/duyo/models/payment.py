"""Payment — one row per checkout attempt (Click / Payme, one-time per period).

The row id (UUID) IS the order id we hand to the gateway: Click's
`merchant_trans_id` and Payme's `account.order_id`. A successful payment flips
`state` to PAID and activates the user's subscription for `period`.

Payme tracks a richer transaction lifecycle (create/perform/cancel times +
numeric state); those millisecond timestamps are stored here so CheckTransaction
and GetStatement can replay them. Click leaves them null.
"""

from enum import Enum
from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column

from duyo.models.base import UUIDPK, Base, TimestampMixin


class PaymentProvider(str, Enum):
    PAYME = "payme"
    CLICK = "click"


class PaymentState(str, Enum):
    PENDING = "pending"     # order created, not yet paid
    PAID = "paid"           # gateway confirmed payment → subscription active
    CANCELLED = "cancelled"  # cancelled/refunded by the gateway


def _enum(enum_cls, name):
    return ENUM(enum_cls, name=name, create_type=False, values_callable=lambda e: [m.value for m in e])


class Payment(Base, UUIDPK, TimestampMixin):
    __tablename__ = "payments"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    provider: Mapped[PaymentProvider] = mapped_column(_enum(PaymentProvider, "payment_provider"), nullable=False)
    tier: Mapped[str] = mapped_column(String(20), nullable=False)       # standart/premium
    period: Mapped[str] = mapped_column(String(10), nullable=False)     # monthly/yearly
    amount: Mapped[int] = mapped_column(Integer, nullable=False)        # UZS so'm (not tiyin)
    state: Mapped[PaymentState] = mapped_column(
        _enum(PaymentState, "payment_state"), nullable=False, default=PaymentState.PENDING,
    )
    # Gateway transaction id (Click click_trans_id / Payme transaction id).
    provider_trans_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    # Payme bookkeeping (epoch ms) — Click leaves these null.
    create_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    perform_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    cancel_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    cancel_reason: Mapped[int | None] = mapped_column(Integer, nullable=True)

    def __repr__(self) -> str:
        return f"<Payment {self.provider.value}:{self.tier}/{self.period} {self.state.value}>"
