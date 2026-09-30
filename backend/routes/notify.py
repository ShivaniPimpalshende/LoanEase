"""
routes/notify.py — F5 WhatsApp / mock notification
Attempts real Twilio integration if credentials present, otherwise logs + mocks.
"""
import os
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Application, Notification
from schemas import NotificationRequest

router = APIRouter()

# Attempt Twilio import — guarded so the app boots without the package
try:
    from twilio.rest import Client as TwilioClient
    _TWILIO_SDK = True
except ImportError:
    _TWILIO_SDK = False


@router.post("/{app_id}/notify")
def notify_applicant(
    app_id: int,
    payload: NotificationRequest | None = Body(default=None),
    db: Session = Depends(get_db),
):
    app: Application | None = db.get(Application, app_id)
    if app is None:
        raise HTTPException(status_code=404, detail="Application not found")

    msg = (payload.custom_message.strip() if payload and payload.custom_message else "") or (
        f"Dear {app.name}, your {app.loan_type} loan application "
        f"(Ref #{app.app_id}) has been reviewed. "
        f"Current status: *{app.recommendation}*. "
        f"{app.explanation_text or ''}"
    )

    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    auth_token  = os.getenv("TWILIO_AUTH_TOKEN",  "")
    demo_phone  = os.getenv("DEMO_PHONE",          "")

    sent_via = "mock"
    if _TWILIO_SDK and account_sid and auth_token and demo_phone:
        try:
            client = TwilioClient(account_sid, auth_token)
            client.messages.create(
                from_="whatsapp:+14155238886",
                to=f"whatsapp:{demo_phone}",
                body=msg,
            )
            sent_via = "twilio"
        except Exception as exc:
            print(f"[TWILIO ERROR] {exc} — falling back to mock")

    # Always log to console
    print(f"[NOTIFY {'TWILIO' if sent_via == 'twilio' else 'MOCK'}] → {app.name}: {app.recommendation}")

    db.add(Notification(
        app_id=app.app_id,
        channel="whatsapp" if sent_via == "twilio" else "mock",
        message=msg,
        delivery_status="DELIVERED" if sent_via == "twilio" else "MOCK_SENT",
    ))
    app.last_notified_status = app.recommendation
    db.commit()

    return {"sent_via": sent_via, "message": msg, "app_id": app_id}
