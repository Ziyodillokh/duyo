"""Click SHOP-API handler tests — sign verification, prepare, complete."""

import asyncio
import hashlib
from dataclasses import dataclass, field
from types import SimpleNamespace
from uuid import uuid4

from duyo.billing import click
from duyo.models.payment import Payment, PaymentProvider, PaymentState
from duyo.models.subscription import Subscription


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _FakeSession:
    scalars_queue: list = field(default_factory=list)
    flushed: bool = False

    async def scalar(self, *_a, **_kw):
        return self.scalars_queue.pop(0)

    def add(self, _obj):
        pass

    async def flush(self):
        self.flushed = True


_SETTINGS = SimpleNamespace(
    click_service_id="100",
    click_secret_key="topsecret",
    click_merchant_id="200",
    click_checkout_url="https://my.click.uz/services/pay",
    payment_return_url="duyo://pay/done",
)


def _payment(**kw) -> Payment:
    p = Payment(
        user_id=uuid4(), provider=PaymentProvider.CLICK,
        tier="standart", period="monthly", amount=29_000,
        state=kw.get("state", PaymentState.PENDING),
    )
    p.id = kw.get("id", uuid4())
    p.provider_trans_id = kw.get("provider_trans_id")
    return p


def _sign(params: dict, *, complete: bool) -> str:
    fields = (
        ["click_trans_id", "service_id", "merchant_trans_id", "merchant_prepare_id",
         "amount", "action", "sign_time"]
        if complete else
        ["click_trans_id", "service_id", "merchant_trans_id", "amount", "action", "sign_time"]
    )
    parts = []
    for f in fields:
        parts.append(str(params.get(f, "")))
        if f == "service_id":
            parts.append(_SETTINGS.click_secret_key)
    return hashlib.md5("".join(parts).encode()).hexdigest()


def _prepare_params(payment: Payment, amount="29000.00") -> dict:
    p = {
        "click_trans_id": "555", "service_id": "100",
        "merchant_trans_id": str(payment.id), "amount": amount,
        "action": "0", "sign_time": "2026-06-01 12:00:00",
    }
    p["sign_string"] = _sign(p, complete=False)
    return p


def _complete_params(payment: Payment, amount="29000.00", error="0") -> dict:
    p = {
        "click_trans_id": "555", "service_id": "100",
        "merchant_trans_id": str(payment.id), "merchant_prepare_id": str(payment.id),
        "amount": amount, "action": "1", "sign_time": "2026-06-01 12:00:00", "error": error,
    }
    p["sign_string"] = _sign(p, complete=True)
    return p


# ── Prepare ──────────────────────────────────────────────────────────────────

def test_prepare_valid_sign_succeeds():
    payment = _payment()
    db = _FakeSession(scalars_queue=[payment])
    resp = _run(click.handle_prepare(db, _prepare_params(payment), _SETTINGS))
    assert resp["error"] == click.ERR_OK
    assert resp["merchant_prepare_id"] == str(payment.id)
    assert payment.provider_trans_id == "555"


def test_prepare_bad_sign_rejected():
    payment = _payment()
    params = _prepare_params(payment)
    params["sign_string"] = "deadbeef"
    db = _FakeSession(scalars_queue=[payment])
    resp = _run(click.handle_prepare(db, params, _SETTINGS))
    assert resp["error"] == click.ERR_SIGN


def test_prepare_amount_mismatch():
    payment = _payment()
    db = _FakeSession(scalars_queue=[payment])
    resp = _run(click.handle_prepare(db, _prepare_params(payment, amount="1000.00"), _SETTINGS))
    assert resp["error"] == click.ERR_AMOUNT


def test_prepare_order_not_found():
    payment = _payment()
    db = _FakeSession(scalars_queue=[None])
    resp = _run(click.handle_prepare(db, _prepare_params(payment), _SETTINGS))
    assert resp["error"] == click.ERR_NOT_FOUND


def test_prepare_already_paid():
    payment = _payment(state=PaymentState.PAID)
    db = _FakeSession(scalars_queue=[payment])
    resp = _run(click.handle_prepare(db, _prepare_params(payment), _SETTINGS))
    assert resp["error"] == click.ERR_ALREADY_PAID


def test_prepare_missing_params():
    db = _FakeSession(scalars_queue=[])
    resp = _run(click.handle_prepare(db, {"click_trans_id": "1"}, _SETTINGS))
    assert resp["error"] == click.ERR_BAD_REQUEST


# ── Complete ─────────────────────────────────────────────────────────────────

def test_complete_activates_subscription():
    payment = _payment(provider_trans_id="555")
    sub = Subscription(user_id=payment.user_id, tier="free", status="active")
    db = _FakeSession(scalars_queue=[payment, sub])
    resp = _run(click.handle_complete(db, _complete_params(payment), _SETTINGS))
    assert resp["error"] == click.ERR_OK
    assert resp["merchant_confirm_id"] == str(payment.id)
    assert payment.state == PaymentState.PAID
    assert sub.tier == "standart" and sub.provider == "click"


def test_complete_wrong_prepare_id():
    payment = _payment(provider_trans_id="555")
    params = _complete_params(payment)
    params["merchant_prepare_id"] = str(uuid4())
    params["sign_string"] = _sign(params, complete=True)
    db = _FakeSession(scalars_queue=[payment])
    resp = _run(click.handle_complete(db, params, _SETTINGS))
    assert resp["error"] == click.ERR_TX_NOT_FOUND


def test_complete_click_error_cancels():
    payment = _payment(provider_trans_id="555")
    resp = _run(click.handle_complete(
        _FakeSession(scalars_queue=[payment]),
        _complete_params(payment, error="-5"), _SETTINGS,
    ))
    assert resp["error"] == click.ERR_CANCELLED
    assert payment.state == PaymentState.CANCELLED


def test_complete_error_after_paid_returns_ok():
    # Out-of-order: Click sends a failure webhook after success → stay paid, answer OK.
    payment = _payment(provider_trans_id="555", state=PaymentState.PAID)
    resp = _run(click.handle_complete(
        _FakeSession(scalars_queue=[payment]),
        _complete_params(payment, error="-5"), _SETTINGS,
    ))
    assert resp["error"] == click.ERR_OK
    assert payment.state == PaymentState.PAID


def test_prepare_non_numeric_amount_rejected():
    payment = _payment()
    db = _FakeSession(scalars_queue=[payment])
    resp = _run(click.handle_prepare(db, _prepare_params(payment, amount="abc"), _SETTINGS))
    assert resp["error"] == click.ERR_AMOUNT


def test_complete_already_paid():
    payment = _payment(provider_trans_id="555", state=PaymentState.PAID)
    resp = _run(click.handle_complete(
        _FakeSession(scalars_queue=[payment]), _complete_params(payment), _SETTINGS,
    ))
    assert resp["error"] == click.ERR_ALREADY_PAID


# ── Checkout URL ─────────────────────────────────────────────────────────────

def test_build_checkout_url():
    payment = _payment()
    url = click.build_checkout_url(payment, _SETTINGS)
    assert url.startswith("https://my.click.uz/services/pay?")
    assert "service_id=100" in url
    assert f"transaction_param={payment.id}" in url
    assert "amount=29000" in url
