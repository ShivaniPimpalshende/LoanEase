# pyrefly: ignore [missing-import]
"""
routes/eligibility.py — F2
    Runs 6 eligibility rules against an Application row and writes back:
  eligibility_status  (PASS | FAIL)
  eligibility_reasons (JSON array)
"""
import json
from sqlalchemy.orm import Session  # pyright: ignore[reportMissingImports]
from models import Application, LoanProduct

# ── Per-loan-type allowed employment types ───────────────────────────────────
ALLOWED_EMPLOYMENT: dict[str, list[str]] = {
    "personal":  ["salaried", "self_employed", "business", "professional", "contract"],
    "home":      ["salaried", "self_employed", "business", "professional", "contract"],
    "auto":      ["salaried", "self_employed", "business", "professional", "contract"],
    "education": ["salaried", "self_employed", "business", "professional", "contract"],
}

MAX_EMI_RATIO = 0.40
RETIREMENT_AGE = 65


def run_eligibility(app: Application, db: Session) -> None:
    """Mutates app in place. Caller must db.commit() afterward."""
    product: LoanProduct | None = (
        db.query(LoanProduct).filter(LoanProduct.loan_type == app.loan_type).first()
    )
    if product is None:
        app.eligibility_status  = "FAIL"
        app.eligibility_reasons = json.dumps([
            {"rule": "loan_type", "status": "FAIL",
             "detail": f"Unknown loan type: {app.loan_type}"}
        ])
        return

    reasons: list[dict] = []

    # ── Rule 1: Age 21–60 ─────────────────────────────────────────────────
    if 21 <= app.age <= 60:
        reasons.append({"rule": "age", "status": "PASS"})
    else:
        reasons.append({
            "rule": "age", "status": "FAIL",
            "detail": f"Age {app.age} is outside the allowed range of 21–60",
        })

    # Rule 2: the loan must finish by retirement age 65.
    end_age = app.age + app.tenure_months / 12
    if end_age <= RETIREMENT_AGE:
        reasons.append({"rule": "retirement_age", "status": "PASS"})
    else:
        reasons.append({
            "rule": "retirement_age", "status": "FAIL",
            "detail": (
                f"Loan would end at age {end_age:.1f}; it must end by age "
                f"{RETIREMENT_AGE}"
            ),
        })

    # ── Rule 3: Monthly income ≥ product minimum ──────────────────────────
    if app.monthly_income >= product.min_income:
        reasons.append({"rule": "income", "status": "PASS"})
    else:
        reasons.append({
            "rule": "income", "status": "FAIL",
            "detail": (
                f"Monthly income ₹{app.monthly_income:,.0f} is below the minimum "
                f"₹{product.min_income:,.0f} required for a {app.loan_type} loan"
            ),
        })

    # ── Rule 4: Employment type allowed for this loan type ────────────────
    allowed = ALLOWED_EMPLOYMENT.get(app.loan_type, [])
    if app.employment_type in allowed:
        reasons.append({"rule": "employment", "status": "PASS"})
    else:
        reasons.append({
            "rule": "employment", "status": "FAIL",
            "detail": (
                f"Employment type '{app.employment_type}' is not eligible for a "
                f"{app.loan_type} loan (allowed: {', '.join(allowed)})"
            ),
        })

    # ── Rule 5: Existing EMI must not exceed 40% of monthly income ─────────
    existing_emi_ratio = app.existing_emi / app.monthly_income
    if existing_emi_ratio <= MAX_EMI_RATIO:
        reasons.append({"rule": "existing_emi", "status": "PASS"})
    else:
        reasons.append({
            "rule": "existing_emi", "status": "FAIL",
            "detail": (
                f"Existing EMI is {existing_emi_ratio:.1%} of monthly income; "
                f"the maximum allowed is {MAX_EMI_RATIO:.0%}"
            ),
        })

    # ── Rule 6: Requested tenure must fit the selected loan product ───────
    if app.tenure_months <= product.max_tenure_months:
        reasons.append({"rule": "tenure", "status": "PASS"})
    else:
        reasons.append({
            "rule": "tenure", "status": "FAIL",
            "detail": (
                f"Requested tenure of {app.tenure_months} months exceeds the "
                f"{product.max_tenure_months}-month maximum for a {app.loan_type} loan"
            ),
        })

    any_fail = any(r["status"] == "FAIL" for r in reasons)
    app.eligibility_status  = "FAIL" if any_fail else "PASS"
    app.eligibility_reasons = json.dumps(reasons)
