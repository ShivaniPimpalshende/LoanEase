import os
import secrets
import time
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

try:
    from twilio.rest import Client as TwilioClient
except ImportError:
    TwilioClient = None

router = APIRouter()
_otp_store: dict[str, dict] = {}
OTP_TTL_SECONDS = 300


class OtpRequest(BaseModel):
    phone: str = Field(..., min_length=8, max_length=20)
    role: str = Field(..., pattern="^(applicant|officer)$")


class OtpVerifyRequest(OtpRequest):
    code: str = Field(..., min_length=4, max_length=8)


def _normalize_phone(phone: str) -> str:
    compact = "".join(char for char in phone.strip() if char.isdigit() or char == "+")
    if not compact.startswith("+"):
        compact = f"+{compact}"
    return compact


def _twilio_configured() -> bool:
    return all(os.getenv(name) for name in (
        "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SERVICE_SID"
    )) and TwilioClient is not None


@router.post("/request-otp")
def request_otp(payload: OtpRequest):
    phone = _normalize_phone(payload.phone)
    if len(phone) < 10:
        raise HTTPException(status_code=422, detail="Enter a valid phone number with country code")

    if _twilio_configured():
        try:
            client = TwilioClient(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
            client.verify.v2.services(os.getenv("TWILIO_VERIFY_SERVICE_SID")).verifications.create(
                to=phone, channel="sms"
            )
            return {"mode": "twilio", "message": "OTP sent to your phone"}
        except Exception as exc:
            print(f"[AUTH TWILIO ERROR] {exc} — falling back to development OTP")

    code = f"{secrets.randbelow(1_000_000):06d}"
    _otp_store[phone] = {"code": code, "role": payload.role, "expires_at": time.time() + OTP_TTL_SECONDS}
    print(f"[AUTH DEV OTP] {phone}: {code}")
    return {"mode": "dev", "message": "Development OTP generated", "dev_otp": code}


@router.post("/verify-otp")
def verify_otp(payload: OtpVerifyRequest):
    phone = _normalize_phone(payload.phone)
    role = payload.role

    if _twilio_configured():
        try:
            client = TwilioClient(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
            check = client.verify.v2.services(os.getenv("TWILIO_VERIFY_SERVICE_SID")).verification_checks.create(
                to=phone, code=payload.code
            )
            if check.status == "approved":
                return {"token": uuid.uuid4().hex, "role": role, "phone": phone, "email": phone}
        except Exception as exc:
            print(f"[AUTH TWILIO VERIFY ERROR] {exc}")

    record = _otp_store.get(phone)
    if record and record["role"] == role and record["expires_at"] >= time.time() and secrets.compare_digest(record["code"], payload.code):
        _otp_store.pop(phone, None)
        return {"token": uuid.uuid4().hex, "role": role, "phone": phone, "email": phone}

    raise HTTPException(status_code=401, detail="Invalid or expired OTP")

    return {"token": uuid.uuid4().hex, "role": role, "phone": phone, "email": phone}
