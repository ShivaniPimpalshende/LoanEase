"""
routes/scoring.py — F3
Calculates EMI (reducing-balance) and produces a three-tier recommendation.
Depends on eligibility_status already being set (run F2 first).
"""
from sqlalchemy.orm import Session
from models import Application, LoanProduct


def _reducing_balance_emi(principal: float, annual_rate: float, months: int) -> float:
    """Standard reducing-balance EMI formula."""
    if months <= 0 or principal <= 0:
        return 0.0
    r = annual_rate / 12          # monthly rate
    if r == 0:
        return principal / months
    return principal * r * (1 + r) ** months / ((1 + r) ** months - 1)


def run_scoring(app: Application, db: Session) -> None:
    """Mutates app in place. Caller must db.commit() afterward."""
    product: LoanProduct | None = (
        db.query(LoanProduct).filter(LoanProduct.loan_type == app.loan_type).first()
    )
    if product is None:
        return

    app.emi_amount = _reducing_balance_emi(
        app.loan_amount, product.interest_rate, app.tenure_months
    )
    app.emi_ratio = (app.emi_amount + app.existing_emi) / app.monthly_income

    # ── Three-tier recommendation ─────────────────────────────────────────
    # Approve: ratio < 0.40 AND credit score > 700 AND eligibility PASS
    # Reject:  ratio > 0.60 OR any eligibility rule failed
    # Review:  everything else
    if (
        app.eligibility_status == "PASS"
        and app.emi_ratio < 0.40
        and app.credit_score > 700
    ):
        app.recommendation = "Approve"
    elif app.emi_ratio > 0.60 or app.eligibility_status == "FAIL":
        app.recommendation = "Reject"
    else:
        app.recommendation = "Review"
