"""Payme Merchant API handler tests — auth + the six JSON-RPC methods."""

import asyncio
import base64
from dataclasses import dataclass, field
from types import SimpleNamespace
from uuid import uuid4

from duyo.billing import payme
from duyo.models.payment import Payment, PaymentProvider, PaymentState
from duyo.models.subscription import Subscription


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@dataclass
class _FakeSession:
    scalars_queue: list = field(default_factory=list)
    statement_rows: list = field(default_factory=list)
    flushed: bool = False

    async def scalar(self, *_a, **_kw):
        return self.scalars_queue.pop(0)

    async def scalars(self, *_a, **_kw):
        return list(self.statement_rows)

    def add(self, _obj):
        pass

    async def flush(self):
        self.flushed = True


_SETTINGS = SimpleNamespace(
    payme_merchant_id="merchant123",
    payme_key="topkey",
    payme_checkout_url="https://checkout.paycom.uz",
    payment_return_url="duyo://pay/done",
)
_AMOUNT_TIYIN = 29_000 * 100


def _payment(**kw) -> Payment:
    p = Payment(
        user_id=uuid4(), provider=PaymentProvider.PAYME,
        tier="standart", period="monthly", amount=29_000,
        state=kw.get("state", PaymentState.PENDING),
    )
    p.id = kw.get("id", uuid4())
    p.provider_trans_id = kw.get("provider_trans_id")
    p.create_time = kw.get("create_time")
    p.perform_time = kw.get("perform_time")
    return p


def _body(method, params, req_id=1):
    return {"method": method, "params": params, "id": req_id}


def _account(payment):
    return {payme.ACCOUNT_FIELD: str(payment.id)}


# ── Auth ─────────────────────────────────────────────────────────────────────

def test_check_auth_valid():
    header = "Basic " + base64.b64encode(b"Paycom:topkey").decode()
    assert payme.check_auth(header, "topkey") is True


def test_check_auth_wrong_key():
    header = "Basic " + base64.b64encode(b"Paycom:wrong").decode()
    assert payme.check_auth(header, "topkey") is False


def test_check_auth_missing():
    assert payme.check_auth(None, "topkey") is False


# ── CheckPerformTransaction ───────────────────────────────────────────────────

def test_check_perform_ok():
    payment = _payment()
    db = _FakeSession(scalars_queue=[payment])
    resp = _run(payme.handle(db, _body("CheckPerformTransaction",
        {"amount": _AMOUNT_TIYIN, "account": _account(payment)})))
    assert resp["result"] == {"allow": True}


def test_check_perform_order_not_found():
    db = _FakeSession(scalars_queue=[None])
    resp = _run(payme.handle(db, _body("CheckPerformTransaction",
        {"amount": _AMOUNT_TIYIN, "account": {"order_id": str(uuid4())}})))
    assert resp["error"]["code"] == payme.ERR_ORDER_NOT_FOUND


def test_check_perform_amount_mismatch():
    payment = _payment()
    db = _FakeSession(scalars_queue=[payment])
    resp = _run(payme.handle(db, _body("CheckPerformTransaction",
        {"amount": 100, "account": _account(payment)})))
    assert resp["error"]["code"] == payme.ERR_AMOUNT


def test_check_perform_already_paid():
    payment = _payment(state=PaymentState.PAID)
    db = _FakeSession(scalars_queue=[payment])
    resp = _run(payme.handle(db, _body("CheckPerformTransaction",
        {"amount": _AMOUNT_TIYIN, "account": _account(payment)})))
    assert resp["error"]["code"] == payme.ERR_CANT_PERFORM


# ── CreateTransaction ─────────────────────────────────────────────────────────

def test_create_assigns_transaction():
    payment = _payment()
    db = _FakeSession(scalars_queue=[payment])
    resp = _run(payme.handle(db, _body("CreateTransaction",
        {"id": "T1", "time": 1_700_000_000_000, "amount": _AMOUNT_TIYIN,
         "account": _account(payment)})))
    assert resp["result"]["state"] == 1
    assert resp["result"]["transaction"] == str(payment.id)
    assert payment.provider_trans_id == "T1"
    assert payment.create_time == 1_700_000_000_000


def test_create_idempotent_same_id():
    payment = _payment(provider_trans_id="T1", create_time=1_700_000_000_000)
    db = _FakeSession(scalars_queue=[payment])
    resp = _run(payme.handle(db, _body("CreateTransaction",
        {"id": "T1", "time": 1_700_000_000_000, "amount": _AMOUNT_TIYIN,
         "account": _account(payment)})))
    assert resp["result"]["state"] == 1


def test_create_order_busy_other_transaction():
    payment = _payment(provider_trans_id="OTHER")
    db = _FakeSession(scalars_queue=[payment])
    resp = _run(payme.handle(db, _body("CreateTransaction",
        {"id": "T2", "amount": _AMOUNT_TIYIN, "account": _account(payment)})))
    assert resp["error"]["code"] == payme.ERR_CANT_PERFORM


# ── PerformTransaction ────────────────────────────────────────────────────────

def test_perform_activates_subscription():
    payment = _payment(provider_trans_id="T1", create_time=1_700_000_000_000)
    sub = Subscription(user_id=payment.user_id, tier="free", status="active")
    db = _FakeSession(scalars_queue=[payment, sub])
    resp = _run(payme.handle(db, _body("PerformTransaction", {"id": "T1"})))
    assert resp["result"]["state"] == 2
    assert payment.state == PaymentState.PAID
    assert payment.perform_time is not None
    assert sub.tier == "standart" and sub.provider == "payme"


def test_perform_idempotent():
    payment = _payment(provider_trans_id="T1", state=PaymentState.PAID, perform_time=123)
    db = _FakeSession(scalars_queue=[payment])
    resp = _run(payme.handle(db, _body("PerformTransaction", {"id": "T1"})))
    assert resp["result"]["state"] == 2
    assert resp["result"]["perform_time"] == 123


def test_perform_transaction_not_found():
    db = _FakeSession(scalars_queue=[None])
    resp = _run(payme.handle(db, _body("PerformTransaction", {"id": "NOPE"})))
    assert resp["error"]["code"] == payme.ERR_TX_NOT_FOUND


# ── CancelTransaction ─────────────────────────────────────────────────────────

def test_cancel_pending_state_minus1():
    payment = _payment(provider_trans_id="T1", create_time=1_700_000_000_000)
    db = _FakeSession(scalars_queue=[payment])
    resp = _run(payme.handle(db, _body("CancelTransaction", {"id": "T1", "reason": 3})))
    assert resp["result"]["state"] == -1
    assert payment.state == PaymentState.CANCELLED
    assert payment.cancel_reason == 3


def test_check_perform_string_amount_rejected():
    payment = _payment()
    db = _FakeSession(scalars_queue=[payment])
    resp = _run(payme.handle(db, _body("CheckPerformTransaction",
        {"amount": "2900000", "account": _account(payment)})))
    assert resp["error"]["code"] == payme.ERR_AMOUNT


def test_cancel_paid_keeps_newer_tier():
    # Order bought 'standart' but the user has since upgraded to 'premium';
    # refunding the old order must NOT clobber the newer plan.
    payment = _payment(provider_trans_id="T1", state=PaymentState.PAID, perform_time=123)
    sub = Subscription(user_id=payment.user_id, tier="premium", status="active", provider="payme")
    db = _FakeSession(scalars_queue=[payment, sub])
    resp = _run(payme.handle(db, _body("CancelTransaction", {"id": "T1", "reason": 5})))
    assert resp["result"]["state"] == -2
    assert sub.tier == "premium"  # untouched


def test_cancel_paid_reverts_subscription_state_minus2():
    payment = _payment(provider_trans_id="T1", state=PaymentState.PAID, perform_time=123)
    sub = Subscription(user_id=payment.user_id, tier="standart", status="active", provider="payme")
    db = _FakeSession(scalars_queue=[payment, sub])
    resp = _run(payme.handle(db, _body("CancelTransaction", {"id": "T1", "reason": 5})))
    assert resp["result"]["state"] == -2
    assert sub.tier == "free" and sub.provider is None


# ── CheckTransaction / GetStatement / dispatch ───────────────────────────────

def test_check_transaction_returns_state():
    payment = _payment(provider_trans_id="T1", state=PaymentState.PAID,
                       create_time=111, perform_time=222)
    db = _FakeSession(scalars_queue=[payment])
    resp = _run(payme.handle(db, _body("CheckTransaction", {"id": "T1"})))
    assert resp["result"]["state"] == 2
    assert resp["result"]["perform_time"] == 222


def test_get_statement_lists_payments():
    payment = _payment(provider_trans_id="T1", create_time=150)
    db = _FakeSession(statement_rows=[payment])
    resp = _run(payme.handle(db, _body("GetStatement", {"from": 100, "to": 200})))
    assert len(resp["result"]["transactions"]) == 1
    assert resp["result"]["transactions"][0]["transaction"] == str(payment.id)


def test_method_not_found():
    db = _FakeSession()
    resp = _run(payme.handle(db, _body("BogusMethod", {})))
    assert resp["error"]["code"] == payme.ERR_METHOD


def test_build_checkout_url_encodes_order_and_amount():
    payment = _payment()
    url = payme.build_checkout_url(payment, _SETTINGS)
    assert url.startswith("https://checkout.paycom.uz/")
    decoded = base64.b64decode(url.rsplit("/", 1)[1]).decode()
    assert f"ac.order_id={payment.id}" in decoded
    assert f"a={_AMOUNT_TIYIN}" in decoded
    assert "m=merchant123" in decoded
