"""Payme Merchant API handler — JSON-RPC 2.0 over a single webhook.

Payme calls one endpoint with {method, params, id}. We authenticate with HTTP
Basic (login is ignored, password == merchant key), then dispatch the six
Merchant API methods. Amounts arrive in tiyin (so'm x 100).

Transaction state: 1 created, 2 performed, -1 cancelled (was created),
-2 cancelled (was performed). The order id travels in account.order_id.
"""

from __future__ import annotations

import base64
import binascii
import hmac
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.billing import service
from duyo.core.config import Settings
from duyo.models.payment import Payment, PaymentProvider, PaymentState

# Payme error codes.
ERR_PARSE = -32700
ERR_AUTH = -32504
ERR_METHOD = -32601
ERR_AMOUNT = -31001
ERR_TX_NOT_FOUND = -31003
ERR_CANT_PERFORM = -31008
ERR_ORDER_NOT_FOUND = -31050

ACCOUNT_FIELD = "order_id"


def _now_ms() -> int:
    return int(datetime.now(UTC).timestamp() * 1000)


def _msg(text: str) -> dict:
    """Payme expects a localized message object."""
    return {"ru": text, "uz": text, "en": text}


def check_auth(authorization: str | None, key: str) -> bool:
    """Verify the Basic-auth password equals the merchant key (constant time)."""
    if not key or not authorization or not authorization.lower().startswith("basic "):
        return False
    try:
        decoded = base64.b64decode(authorization[6:]).decode()
    except (binascii.Error, ValueError, UnicodeDecodeError):
        return False
    _, _, password = decoded.partition(":")
    return hmac.compare_digest(password, key)


def error_response(req_id, code: int, message: str, data=None) -> dict:
    err: dict = {"code": code, "message": _msg(message)}
    if data is not None:
        err["data"] = data
    return {"error": err, "id": req_id}


def _ok(req_id, result: dict) -> dict:
    return {"result": result, "id": req_id}


def _payme_state(p: Payment) -> int:
    if p.state == PaymentState.PENDING:
        return 1
    if p.state == PaymentState.PAID:
        return 2
    return -2 if p.perform_time else -1


def _amount_ok(params: dict, payment: Payment) -> bool:
    amount = params.get("amount")
    # Payme sends amount as an integer in tiyin; reject anything else.
    if not isinstance(amount, int) or isinstance(amount, bool) or amount <= 0:
        return False
    return amount == payment.amount * 100


async def _by_order(db: AsyncSession, params: dict, *, for_update: bool = False) -> Payment | None:
    order_id = (params.get("account") or {}).get(ACCOUNT_FIELD)
    payment = await service.get_payment(db, order_id, for_update=for_update) if order_id else None
    if payment is None or payment.provider != PaymentProvider.PAYME:
        return None
    return payment


async def _by_trans(db: AsyncSession, params: dict, *, for_update: bool = False) -> Payment | None:
    tid = params.get("id")
    if not tid:
        return None
    stmt = select(Payment).where(
        Payment.provider_trans_id == str(tid),
        Payment.provider == PaymentProvider.PAYME,
    )
    if for_update:
        stmt = stmt.with_for_update()
    return await db.scalar(stmt)


async def _check_perform(db, req_id, params) -> dict:
    payment = await _by_order(db, params)
    if payment is None:
        return error_response(req_id, ERR_ORDER_NOT_FOUND, "Buyurtma topilmadi", data=ACCOUNT_FIELD)
    if not _amount_ok(params, payment):
        return error_response(req_id, ERR_AMOUNT, "Noto'g'ri summa")
    if payment.state != PaymentState.PENDING:
        return error_response(req_id, ERR_CANT_PERFORM, "Buyurtma allaqachon to'langan yoki bekor qilingan")
    return _ok(req_id, {"allow": True})


async def _create(db, req_id, params) -> dict:
    payment = await _by_order(db, params, for_update=True)
    if payment is None:
        return error_response(req_id, ERR_ORDER_NOT_FOUND, "Buyurtma topilmadi", data=ACCOUNT_FIELD)
    if not _amount_ok(params, payment):
        return error_response(req_id, ERR_AMOUNT, "Noto'g'ri summa")

    tid = str(params.get("id"))
    if payment.provider_trans_id == tid:
        # Idempotent re-call for the same Payme transaction.
        if payment.state != PaymentState.PENDING:
            return error_response(req_id, ERR_CANT_PERFORM, "Tranzaksiya holati noto'g'ri")
        return _ok(req_id, {"create_time": payment.create_time, "transaction": str(payment.id), "state": 1})
    if payment.provider_trans_id is not None or payment.state != PaymentState.PENDING:
        return error_response(req_id, ERR_CANT_PERFORM, "Buyurtma band")

    payment.provider_trans_id = tid
    payment.create_time = int(params.get("time") or _now_ms())
    await db.flush()
    return _ok(req_id, {"create_time": payment.create_time, "transaction": str(payment.id), "state": 1})


async def _perform(db, req_id, params) -> dict:
    payment = await _by_trans(db, params, for_update=True)
    if payment is None:
        return error_response(req_id, ERR_TX_NOT_FOUND, "Tranzaksiya topilmadi")
    if payment.state == PaymentState.PAID:
        return _ok(req_id, {"transaction": str(payment.id), "perform_time": payment.perform_time, "state": 2})
    if payment.state != PaymentState.PENDING:
        return error_response(req_id, ERR_CANT_PERFORM, "Tranzaksiya bekor qilingan")

    payment.perform_time = _now_ms()
    payment.state = PaymentState.PAID
    await service.activate_subscription(db, payment.user_id, payment.tier, payment.period, provider="payme")
    await db.flush()
    return _ok(req_id, {"transaction": str(payment.id), "perform_time": payment.perform_time, "state": 2})


async def _cancel(db, req_id, params) -> dict:
    payment = await _by_trans(db, params, for_update=True)
    if payment is None:
        return error_response(req_id, ERR_TX_NOT_FOUND, "Tranzaksiya topilmadi")

    if payment.state != PaymentState.CANCELLED:
        was_paid = payment.state == PaymentState.PAID
        payment.state = PaymentState.CANCELLED
        payment.cancel_time = _now_ms()
        payment.cancel_reason = params.get("reason")
        if was_paid:
            # Only revert if the user is still on the tier this order bought —
            # a later upgrade must not be clobbered by an old refund.
            await service.revert_to_free(db, payment.user_id, only_if_tier=payment.tier)
        await db.flush()
    return _ok(req_id, {
        "transaction": str(payment.id),
        "cancel_time": payment.cancel_time,
        "state": _payme_state(payment),
    })


async def _check(db, req_id, params) -> dict:
    payment = await _by_trans(db, params)
    if payment is None:
        return error_response(req_id, ERR_TX_NOT_FOUND, "Tranzaksiya topilmadi")
    return _ok(req_id, {
        "create_time": payment.create_time or 0,
        "perform_time": payment.perform_time or 0,
        "cancel_time": payment.cancel_time or 0,
        "transaction": str(payment.id),
        "state": _payme_state(payment),
        "reason": payment.cancel_reason,
    })


async def _statement(db, req_id, params) -> dict:
    frm, to = params.get("from", 0), params.get("to", 0)
    rows = await db.scalars(
        select(Payment).where(
            Payment.provider == PaymentProvider.PAYME,
            Payment.create_time.is_not(None),
            Payment.create_time >= frm,
            Payment.create_time <= to,
        )
    )
    transactions = [
        {
            "id": p.provider_trans_id,
            "time": p.create_time,
            "amount": p.amount * 100,
            "account": {ACCOUNT_FIELD: str(p.id)},
            "create_time": p.create_time or 0,
            "perform_time": p.perform_time or 0,
            "cancel_time": p.cancel_time or 0,
            "transaction": str(p.id),
            "state": _payme_state(p),
            "reason": p.cancel_reason,
        }
        for p in rows
    ]
    return _ok(req_id, {"transactions": transactions})


_METHODS = {
    "CheckPerformTransaction": _check_perform,
    "CreateTransaction": _create,
    "PerformTransaction": _perform,
    "CancelTransaction": _cancel,
    "CheckTransaction": _check,
    "GetStatement": _statement,
}


async def handle(db: AsyncSession, body: dict) -> dict:
    """Dispatch a Payme JSON-RPC request. Auth must be verified by the caller."""
    req_id = body.get("id")
    method = body.get("method")
    params = body.get("params") or {}
    handler = _METHODS.get(method)
    if handler is None:
        return error_response(req_id, ERR_METHOD, "Method not found")
    return await handler(db, req_id, params)


def build_checkout_url(payment: Payment, settings: Settings) -> str:
    """checkout.paycom.uz/<base64(m=...;ac.order_id=...;a=<tiyin>;c=<return>)>."""
    parts = [
        f"m={settings.payme_merchant_id}",
        f"ac.{ACCOUNT_FIELD}={payment.id}",
        f"a={payment.amount * 100}",
    ]
    if settings.payment_return_url:
        parts.append(f"c={settings.payment_return_url}")
    encoded = base64.b64encode(";".join(parts).encode()).decode()
    return f"{settings.payme_checkout_url}/{encoded}"


def is_configured(settings: Settings) -> bool:
    return bool(settings.payme_merchant_id and settings.payme_key)
