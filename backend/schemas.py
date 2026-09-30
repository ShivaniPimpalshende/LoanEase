from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
import json


# ── Request: create a new application (F1 form) ─────────────────────────────
class ApplicationCreate(BaseModel):
    name:            str   = Field(..., min_length=2, max_length=100)
    age:             int   = Field(..., ge=18, le=100)
    employment_type: str   = Field(...)
    monthly_income:  float = Field(..., gt=0)
    loan_type:       str   = Field(...)
    loan_amount:     float = Field(..., gt=0)
    tenure_months:   int   = Field(..., ge=1, le=360)
    existing_emi:    float = Field(default=0, ge=0)
    credit_score:    int   = Field(..., ge=300, le=900)

    @field_validator("employment_type")
    @classmethod
    def valid_employment(cls, v: str) -> str:
        allowed = ["salaried", "self_employed", "business", "professional", "contract"]
        if v not in allowed:
            raise ValueError(f"employment_type must be one of {allowed}")
        return v

    @field_validator("loan_type")
    @classmethod
    def valid_loan_type(cls, v: str) -> str:
        allowed = ["personal", "home", "auto", "education"]
        if v not in allowed:
            raise ValueError(f"loan_type must be one of {allowed}")
        return v


# ── Request: officer manual override (F4) ───────────────────────────────────
class OverrideRequest(BaseModel):
    recommendation: str = Field(...)

    @field_validator("recommendation")
    @classmethod
    def valid_rec(cls, v: str) -> str:
        allowed = ["Approve", "Review", "Reject"]
        if v not in allowed:
            raise ValueError(f"recommendation must be one of {allowed}")
        return v


class TermsRequest(BaseModel):
    loan_amount: Optional[float] = Field(None, gt=0)
    tenure_months: Optional[int] = Field(None, ge=1, le=360)
    loan_type: Optional[str] = Field(None)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    history: Optional[List[dict]] = None


class NotificationRequest(BaseModel):
    custom_message: Optional[str] = Field(None, min_length=1, max_length=2000)


# ── Response: full application row ──────────────────────────────────────────
class ApplicationOut(BaseModel):
    app_id:              int
    name:                str
    age:                 int
    employment_type:     str
    monthly_income:      float
    loan_type:           str
    loan_amount:         float
    tenure_months:       int
    existing_emi:        float
    credit_score:        int
    eligibility_status:  Optional[str]
    eligibility_reasons: Optional[list]   # parsed from JSON string
    emi_amount:          Optional[float]
    emi_ratio:           Optional[float]
    recommendation:      Optional[str]
    explanation_text:    Optional[str]
    priority_rank:       Optional[int]
    last_notified_status:Optional[str]
    gap_to_approval:     Optional[dict]   # parsed from JSON string

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_obj(cls, obj) -> "ApplicationOut":
        data = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
        # Parse JSON fields
        for field in ("eligibility_reasons", "gap_to_approval"):
            raw = data.get(field)
            if isinstance(raw, str):
                try:
                    data[field] = json.loads(raw)
                except Exception:
                    data[field] = None
        return cls(**data)


# ── Response: loan product ───────────────────────────────────────────────────
class LoanProductOut(BaseModel):
    loan_type:         str
    interest_rate:     float
    min_income:        float
    max_tenure_months: int

    model_config = {"from_attributes": True}


# ── Response: stats ──────────────────────────────────────────────────────────
class StatsOut(BaseModel):
    total:   int
    pending: int
    approve: int
    review:  int
    reject:  int
    by_loan_type: List[dict]
