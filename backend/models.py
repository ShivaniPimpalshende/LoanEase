# pyrefly: ignore [missing-import]
from sqlalchemy import Column, Integer, String, Float, Text, DateTime
from datetime import datetime
from database import Base


class LoanProduct(Base):
    __tablename__ = "loan_products"

    loan_type         = Column(String,  primary_key=True)
    interest_rate     = Column(Float,   nullable=False)   # annual decimal e.g. 0.12
    min_income        = Column(Float,   nullable=False)   # monthly ₹
    max_tenure_months = Column(Integer, nullable=False)


class Application(Base):
    __tablename__ = "applications"

    # ── Applicant fields (F1) ────────────────────────────────────────────────
    app_id           = Column(Integer, primary_key=True, autoincrement=True)
    name             = Column(String,  nullable=False)
    age              = Column(Integer, nullable=False)
    employment_type  = Column(String,  nullable=False)   # salaried|self_employed|business|contract
    monthly_income   = Column(Float,   nullable=False)
    loan_type        = Column(String,  nullable=False)   # FK → loan_products
    loan_amount      = Column(Float,   nullable=False)
    tenure_months    = Column(Integer, nullable=False)
    existing_emi     = Column(Float,   nullable=False, default=0)
    credit_score     = Column(Integer, nullable=False)

    # ── Pipeline fields (F2 + F3) ────────────────────────────────────────────
    eligibility_status  = Column(String,  nullable=True)  # PASS | FAIL
    eligibility_reasons = Column(Text,    nullable=True)  # JSON array string
    emi_amount          = Column(Float,   nullable=True)
    emi_ratio           = Column(Float,   nullable=True)
    recommendation      = Column(String,  nullable=True)  # Approve | Review | Reject

    # ── F5 fields ────────────────────────────────────────────────────────────
    explanation_text     = Column(Text,    nullable=True)
    priority_rank        = Column(Integer, nullable=True)  # 1=Review 2=Reject 3=Approve
    last_notified_status = Column(String,  nullable=True)
    gap_to_approval      = Column(Text,    nullable=True)  # JSON


class StatusHistory(Base):
    __tablename__ = "status_history"

    history_id  = Column(Integer, primary_key=True, autoincrement=True)
    app_id      = Column(Integer, nullable=False)
    old_status  = Column(String, nullable=True)
    new_status  = Column(String, nullable=False)
    changed_by  = Column(String, nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"

    notification_id = Column(Integer, primary_key=True, autoincrement=True)
    app_id          = Column(Integer, nullable=False)
    channel         = Column(String, nullable=False)
    message         = Column(Text, nullable=False)
    delivery_status = Column(String, nullable=False)
    sent_at         = Column(DateTime, default=datetime.utcnow, nullable=False)
