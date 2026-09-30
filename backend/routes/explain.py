"""
routes/explain.py — F5
Generates:
  explanation_text   — plain-language explanation of the decision
  priority_rank      — sort key (Review=1, Reject=2, Approve=3)
  gap_to_approval    — smallest loan/tenure change that flips to Approve (F5.1)
"""
import json
from sqlalchemy.orm import Session
from models import Application, LoanProduct

RETIREMENT_AGE = 65


def _reducing_balance_emi(principal: float, annual_rate: float, months: int) -> float:
    if months <= 0 or principal <= 0:
        return 0.0
    r = annual_rate / 12
    if r == 0:
        return principal / months
    return principal * r * (1 + r) ** months / ((1 + r) ** months - 1)


def run_explain(app: Application, db: Session) -> None:
    """Generates human-readable explanation and priority rank."""
    ratio_pct = (app.emi_ratio or 0) * 100

    # Build plain-language explanation
    reasons_text = ""
    if app.eligibility_reasons:
        try:
            reasons = json.loads(app.eligibility_reasons)
            failed = [r for r in reasons if r["status"] == "FAIL"]
            if failed:
                details = "; ".join(r.get("detail", r["rule"]) for r in failed)
                reasons_text = f" Failed eligibility checks: {details}."
        except Exception:
            pass

    app.explanation_text = (
        f"{app.name} applied for a \u20b9{app.loan_amount:,.0f} {app.loan_type} loan "
        f"over {app.tenure_months} months. "
        f"Their total EMI burden would be {ratio_pct:.1f}% of monthly income "
        f"(\u20b9{app.emi_amount:,.0f} new EMI + \u20b9{app.existing_emi:,.0f} existing EMI). "
        f"Credit score: {app.credit_score}.{reasons_text} "
        f"Decision: {app.recommendation}."
    )

    # Priority: Review first (most actionable), then Reject, then Approve
    app.priority_rank = {"Pending": 1, "Review": 2, "Reject": 3, "Approve": 4}.get(
        app.recommendation, 9
    )


def run_gap(app: Application, db: Session) -> None:
    """
    F5.1 — Gap-to-Approval Calculator.
    Tests all combinations of:
      loan amount reduction: 0, 10, 20, 30 %
      tenure extension:      0, 12, 24, 36 months
    Finds the SMALLEST change that flips the result to Approve.
    """
    if app.recommendation == "Approve" or (
        app.eligibility_status == "PASS"
        and (app.emi_ratio or 0) < 0.40
        and app.credit_score > 700
    ):
        app.gap_to_approval = json.dumps({"status": "already_approved"})
        return

    product: LoanProduct | None = (
        db.query(LoanProduct).filter(LoanProduct.loan_type == app.loan_type).first()
    )
    if product is None:
        app.gap_to_approval = json.dumps({"status": "no_product_found"})
        return

    candidates: list[dict] = []

    for amt_cut in [0.00, 0.10, 0.20, 0.30]:
        for extra_months in [0, 12, 24, 36]:
            if amt_cut == 0.00 and extra_months == 0:
                continue  # skip no-change scenario

            new_amount  = app.loan_amount * (1 - amt_cut)
            new_tenure  = min(
                app.tenure_months + extra_months,
                product.max_tenure_months
            )
            new_emi     = _reducing_balance_emi(
                new_amount, product.interest_rate, new_tenure
            )
            new_ratio   = (new_emi + app.existing_emi) / app.monthly_income
            flips       = (
                new_ratio < 0.40
                and app.credit_score > 700
                and app.eligibility_status == "PASS"
                and app.age + new_tenure / 12 <= RETIREMENT_AGE
            )
            candidates.append({
                "amount_reduction_pct": int(amt_cut * 100),
                "extra_months":         extra_months,
                "new_loan_amount":      round(new_amount),
                "new_tenure_months":    new_tenure,
                "new_emi":              round(new_emi),
                "new_emi_ratio":        round(new_ratio, 3),
                "flips_to_approve":     flips,
            })

    winning = [c for c in candidates if c["flips_to_approve"]]
    # Sort by smallest change: least amount cut first, then fewest extra months
    winning.sort(key=lambda c: (c["amount_reduction_pct"], c["extra_months"]))

    if winning:
        app.gap_to_approval = json.dumps(winning[0])
    else:
        # No path found — still return best partial improvement (lowest ratio)
        candidates.sort(key=lambda c: c["new_emi_ratio"])
        app.gap_to_approval = json.dumps({
            "status":        "no_path_found",
            "best_scenario": candidates[0] if candidates else None,
        })
