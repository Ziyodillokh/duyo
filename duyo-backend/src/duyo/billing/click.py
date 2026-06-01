"""Click SHOP-API handler — Prepare (action=0) + Complete (action=1).

Click calls these two form-encoded webhooks. We verify the MD5 signature, match
the order, and on Complete activate the subscription. Amounts are in so'm.

Signature (per Click SHOP-API spec):
  prepare:  md5(click_trans_id + service_id + secret_key + merchant_trans_id
                + amount + action + sign_time)
  complete: md5(click_trans_id + service_id + secret_key + merchant_trans_id
                + merchant_prepare_id + amount + action + sign_time)
"""

from __future__ import annotations

import hashlib
import hmac
from decimal import Decimal, InvalidOperation
from urllib.parse import urlencode

from sqlalchemy.ext.asyncio import AsyncSession

from duyo.billing import service
from duyo.core.config import Settings
from duyo.models.payment import Payment, PaymentProvider, PaymentState

# Click SHOP-API error codes (returned in the `error` field).
ERR_OK = 0
ERR_SIGN = -1
ERR_AMOUNT = -2
ERR_ACTION = -3
ERR_ALREADY_PAID = -4
ERR_NOT_FOUND = -5         # order (merchant_trans_id) not found
ERR_TX_NOT_FOUND = -6      # prepare step not found on complete
ERR_BAD_REQUEST = -8       # required params missing
ERR_CANCELLED = -9

ACTION_PREPARE = "0"
ACTION_COMPLETE = "1"

_PREPARE_FIELDS = (
    "click_trans_id", "service_id", "merchant_trans_id", "amount", "action", "sign_time",
)
_COMPLETE_FIELDS = (
    "click_trans_id", "service_id", "merchant_trans_id", "merchant_prepare_id",
    "amount", "action", "sign_time",
)


def is_configured(settings: Settings) -> bool:
    return bool(settings.click_service_id and settings.click_secret_key and settings.click_merchant_id)


def _expected_sign(params: dict, secret_key: str, *, complete: bool) -> str:
    fields = _COMPLETE_FIELDS if complete else _PREPARE_FIELDS
    # secret_key sits right after service_id in the concatenation.
    parts: list[str] = []
    for f in fields:
        parts.append(str(params.get(f, "")))
        if f == "service_id":
            parts.append(secret_key)
    return hashlib.md5("".join(parts).encode()).hexdigest()  # Click mandates MD5


def verify_sign(params: dict, secret_key: str, *, complete: bool) -> bool:
    given = str(params.get("sign_string", ""))
    return hmac.compare_digest(given, _expected_sign(params, secret_key, complete=complete))


def _amount_matches(params: dict, payment: Payment) -> bool:
    # Click sends so'm as a decimal string ("29000.00"); Decimal avoids the
    # float rounding that could let a near-miss amount pass.
    try:
        return int(Decimal(str(params.get("amount", "")))) == payment.amount
    except (InvalidOperation, TypeError, ValueError):
        return False


def _resp(params: dict, error: int, note: str, **extra) -> dict:
    return {
        "click_trans_id": params.get("click_trans_id"),
        "merchant_trans_id": params.get("merchant_trans_id"),
        "error": error,
        "error_note": note,
        **extra,
    }


def build_checkout_url(payment: Payment, settings: Settings) -> str:
    """GET redirect to my.click.uz; `transaction_param` is our order id."""
    query = {
        "service_id": settings.click_service_id,
        "merchant_id": settings.click_merchant_id,
        "amount": payment.amount,
        "transaction_param": str(payment.id),
    }
    if settings.payment_return_url:
        query["return_url"] = settings.payment_return_url
    return f"{settings.click_checkout_url}?{urlencode(query)}"


async def handle_prepare(db: AsyncSession, params: dict, settings: Settings) -> dict:
    if not all(params.get(f) for f in _PREPARE_FIELDS) or not params.get("sign_string"):
        return _resp(params, ERR_BAD_REQUEST, "Missing parameters")
    if not verify_sign(params, settings.click_secret_key, complete=False):
        return _resp(params, ERR_SIGN, "Signature verification failed")

    payment = await service.get_payment(db, params.get("merchant_trans_id"), for_update=True)
    if payment is None or payment.provider != PaymentProvider.CLICK:
        return _resp(params, ERR_NOT_FOUND, "Order not found")
    if payment.state == PaymentState.PAID:
        return _resp(params, ERR_ALREADY_PAID, "Already paid")
    if payment.state == PaymentState.CANCELLED:
        return _resp(params, ERR_CANCELLED, "Transaction cancelled")
    if not _amount_matches(params, payment):
        return _resp(params, ERR_AMOUNT, "Incorrect amount")

    payment.provider_trans_id = str(params.get("click_trans_id"))
    await db.flush()
    return _resp(params, ERR_OK, "Success", merchant_prepare_id=str(payment.id))


async def handle_complete(db: AsyncSession, params: dict, settings: Settings) -> dict:
    if not all(params.get(f) for f in _COMPLETE_FIELDS) or not params.get("sign_string"):
        return _resp(params, ERR_BAD_REQUEST, "Missing parameters")
    if not verify_sign(params, settings.click_secret_key, complete=True):
        return _resp(params, ERR_SIGN, "Signature verification failed")

    payment = await service.get_payment(db, params.get("merchant_trans_id"), for_update=True)
    if payment is None or payment.provider != PaymentProvider.CLICK:
        return _resp(params, ERR_NOT_FOUND, "Order not found")
    if str(params.get("merchant_prepare_id")) != str(payment.id):
        return _resp(params, ERR_TX_NOT_FOUND, "Prepare step not found")
    if not _amount_matches(params, payment):
        return _resp(params, ERR_AMOUNT, "Incorrect amount")

    # Click signals its own failure via a negative `error` param → cancel.
    try:
        click_error = int(params.get("error", 0))
    except (TypeError, ValueError):
        click_error = 0
    if click_error < 0:
        # Out-of-order delivery: a failure after a confirmed payment must stay
        # paid and answer OK so Click stops retrying.
        if payment.state == PaymentState.PAID:
            return _resp(params, ERR_OK, "Already paid", merchant_confirm_id=str(payment.id))
        payment.state = PaymentState.CANCELLED
        await db.flush()
        return _resp(params, ERR_CANCELLED, "Payment failed on Click side")

    if payment.state == PaymentState.PAID:
        return _resp(params, ERR_ALREADY_PAID, "Already paid")
    if payment.state == PaymentState.CANCELLED:
        return _resp(params, ERR_CANCELLED, "Transaction cancelled")

    payment.state = PaymentState.PAID
    await service.activate_subscription(
        db, payment.user_id, payment.tier, payment.period, provider="click",
    )
    await db.flush()
    return _resp(params, ERR_OK, "Success", merchant_confirm_id=str(payment.id))
