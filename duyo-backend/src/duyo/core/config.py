"""Application configuration loaded from environment variables."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Immutable application settings. Values come from .env or environment."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_env: Literal["development", "staging", "production"] = "development"
    app_debug: bool = False
    app_secret_key: str = Field(min_length=16)

    # Database
    database_url: str = "postgresql+asyncpg://duyo:duyo_dev_password@localhost:5432/duyo"
    database_echo: bool = False

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 30
    jwt_algorithm: str = "HS256"

    # AI — Gemini primary (D-010 revised 2026-05-27)
    google_api_key: str = ""
    gemini_model_primary: str = "gemini-2.5-flash"
    gemini_model_fallback: str = "gemini-2.5-pro"
    # Embedding — gemini-embedding-001 (text-embedding-004 retired).
    # Output truncated to 768-dim via MRL to match the vector(768) DB column.
    gemini_embedding_model: str = "gemini-embedding-001"
    gemini_embedding_dim: int = 768
    # Voice mode (D-005 v3, 2026-05-27 POC accepted) — single-stack STT+chat+native audio.
    gemini_model_live: str = "gemini-3.1-flash-live-preview"
    gemini_live_input_sample_rate: int = 16_000
    gemini_live_output_sample_rate: int = 24_000
    gemini_temperature: float = 0.7
    gemini_max_output_tokens: int = 2000
    gemini_thinking_budget_flash: int = 0  # Flash thinking off, Pro always-on

    # Conversation context window — last N messages sent back as history.
    # Each turn is ~80-150 tokens; 20 messages ≈ 1500-3000 input tokens,
    # well within Flash's 1M context. Larger windows pay more per turn.
    conversation_history_max_messages: int = 20

    # OTP / SMS (Eskiz.uz)
    otp_length: int = 5
    otp_ttl_seconds: int = 300  # 5 minutes
    otp_max_attempts: int = 5
    otp_rate_limit_per_phone_per_hour: int = 10
    # Test phones that bypass SMS — comma-separated "phone:code" pairs. These
    # numbers always accept their fixed code (no SMS needed) for QA/testing.
    # Empty by default: a hard-coded fake number in the shipped defaults means
    # every deployment carries an account nobody owns.
    otp_test_numbers: str = ""
    # Pilot escape hatch while no SMS provider is connected: when set (e.g.
    # "00000"), THIS ONE CODE is accepted for EVERY phone number, so testers
    # sign up with their own real number and get a real account.
    #
    # Understand the trade-off before switching it on: while it is set, anyone
    # who knows the code can log in as any phone number and read that family's
    # conversations. It is acceptable only for a short pilot whose data is
    # treated as non-private. Clear it the day Eskiz credentials land.
    otp_demo_code: str = ""
    # Second key for the same lock. In production the app refuses to start with
    # a demo code unless someone has also set this, so the pilot setting can
    # never survive into a real launch by inheritance or by accident.
    otp_demo_allow_in_production: bool = False
    eskiz_email: str = ""
    eskiz_password: str = ""
    eskiz_from: str = "DUYO"
    # Dev stub — when no real Eskiz creds, OTP is logged instead of sent.
    # In production this is False and missing creds will fail loudly.
    sms_stub_enabled: bool = True

    # Crisis detection thresholds (Layer 3 ML classifier — not used yet)
    crisis_threshold_yellow: float = 0.70
    crisis_threshold_orange: float = 0.85
    crisis_threshold_red: float = 0.95

    # Payments — Click + Payme, one-time per billing period. Credential-ready:
    # checkout/webhooks return 503 until the matching keys are configured, so
    # the build ships without secrets and keys are added per environment.
    payme_merchant_id: str = ""
    payme_key: str = ""  # merchant key — the webhook Basic-auth password (Paycom:KEY)
    payme_checkout_url: str = "https://checkout.paycom.uz"
    click_merchant_id: str = ""
    click_service_id: str = ""
    click_secret_key: str = ""
    click_checkout_url: str = "https://my.click.uz/services/pay"
    # Deep link the gateway returns the user to after payment (optional).
    payment_return_url: str = ""

    # Object storage (MinIO/S3) for uploaded media — content cover images, PDFs, audio.
    # Local dev points at the standalone minio on :9100; prod uses the duyo-minio alias.
    minio_endpoint: str = "localhost:9100"
    minio_access_key: str = "duyo"
    minio_secret_key: str = "duyo_dev_password"
    minio_secure: bool = False  # True for https endpoints
    minio_bucket: str = "media"
    # Absolute base the app uses to fetch served media (GET /v1/content/media/{key}).
    public_base_url: str = "http://localhost:8000"

    @model_validator(mode="after")
    def _guard_demo_otp_code(self) -> "Settings":
        """A pilot login bypass must be chosen twice to reach production.

        Refusing to boot is deliberate: the deploy is health-gated and rolls
        back, so a demo code that slipped into a production release fails
        visibly at deploy time instead of quietly staying open for months.
        """
        if self.otp_demo_code and self.app_env == "production" and not self.otp_demo_allow_in_production:
            raise ValueError(
                "OTP_DEMO_CODE is set while APP_ENV=production. Every phone "
                "number would accept that one code. Set "
                "OTP_DEMO_ALLOW_IN_PRODUCTION=true to accept that during the "
                "pilot, or clear OTP_DEMO_CODE."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor. Use this everywhere instead of instantiating Settings."""
    return Settings()  # type: ignore[call-arg]
