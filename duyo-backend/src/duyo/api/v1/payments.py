"""Payment endpoints — real Click/Payme checkout + provider webhooks.

  POST /payments/checkout        create an order, return a gateway checkout URL (auth)
  POST /payments/payme           Payme Merchant API webhook (Basic auth from Payme)
  POST /payments/click/prepare   Click SHOP-API Prepare  (signed form)
  POST /payments/click/complete  Click SHOP-API Complete (signed form)

Webhooks are unauthenticated at the bearer-token layer; each gateway authenticates
itself (Payme: Basic key; Click: MD5 signature). They always return HTTP 200 with
the provider's own status code in the body.
"""

from json import JSONDecodeError

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from duyo.api.deps import get_current_user, get_db
from duyo.billing import click, payme, service
from duyo.core.config import Settings, get_settings
from duyo.models.payment import PaymentProvider
from duyo.models.user import User
from duyo.schemas.payment import CheckoutRequest, CheckoutResponse

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/checkout", response_model=CheckoutResponse)
async def checkout(
    payload: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> CheckoutResponse:
    """Create a pending order and return the gateway checkout URL for the app."""
    provider = PaymentProvider(payload.provider)
    configured = click.is_configured(settings) if provider == PaymentProvider.CLICK else payme.is_configured(settings)
    if not configured:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"To'lov provayderi '{payload.provider}' hali sozlanmagan",
        )

    payment = await service.create_payment(db, current_user.id, payload.tier, payload.period, provider)
    builder = click.build_checkout_url if provider == PaymentProvider.CLICK else payme.build_checkout_url
    return CheckoutResponse(
        order_id=str(payment.id),
        provider=payload.provider,
        amount=payment.amount,
        checkout_url=builder(payment, settings),
    )


@router.post("/payme")
async def payme_webhook(
    request: Request,
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Payme Merchant API JSON-RPC endpoint."""
    try:
        body = await request.json()
    except (JSONDecodeError, UnicodeDecodeError):
        return payme.error_response(None, payme.ERR_PARSE, "Parse error")
    if not isinstance(body, dict):
        return payme.error_response(None, payme.ERR_PARSE, "Parse error")
    if not payme.check_auth(authorization, settings.payme_key):
        return payme.error_response(body.get("id"), payme.ERR_AUTH, "Insufficient privileges")
    return await payme.handle(db, body)


@router.post("/click/prepare")
async def click_prepare(
    request: Request,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Click SHOP-API Prepare (action=0)."""
    params = dict(await request.form())
    return await click.handle_prepare(db, params, settings)


@router.post("/click/complete")
async def click_complete(
    request: Request,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    """Click SHOP-API Complete (action=1)."""
    params = dict(await request.form())
    return await click.handle_complete(db, params, settings)
