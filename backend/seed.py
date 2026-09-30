"""
seed.py — Generates and inserts:
  • 4 loan product rows
  • 100 application rows  (35 Approve / 30 Review / 35 Reject)

Runs the full F2 + F3 + F5 pipeline on every row so the DB is
immediately usable without starting the API server.

Usage:
    cd backend
    python seed.py
"""

import json
import math
import random
import sys
import os

# ── Make sure we can import sibling modules ────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))

from database import engine, SessionLocal, Base
from models import Application, LoanProduct

# ── Reproducible randomness ────────────────────────────────────────────────
random.seed(42)

# ══════════════════════════════════════════════════════════════════════════
#  CONSTANTS / BUSINESS RULES  (mirrors eligibility.py and scoring.py)
# ══════════════════════════════════════════════════════════════════════════

LOAN_PRODUCTS = [
    {"loan_type": "personal",   "interest_rate": 0.14,  "min_income": 25_000,  "max_tenure_months": 60},
    {"loan_type": "home",       "interest_rate": 0.085, "min_income": 50_000,  "max_tenure_months": 360},
    {"loan_type": "auto",       "interest_rate": 0.10,  "min_income": 30_000,  "max_tenure_months": 84},
    {"loan_type": "education",  "interest_rate": 0.09,  "min_income": 20_000,  "max_tenure_months": 120},
]

# Employment types allowed per loan type
ALLOWED_EMPLOYMENT = {
    "personal":  ["salaried", "self_employed", "business", "professional", "contract"],
    "home":      ["salaried", "self_employed", "business", "professional", "contract"],
    "auto":      ["salaried", "self_employed", "business", "professional", "contract"],
    "education": ["salaried", "self_employed", "business", "professional", "contract"],
}

MAX_EMI_RATIO = 0.40
RETIREMENT_AGE = 65

# ══════════════════════════════════════════════════════════════════════════
#  SAMPLE DATA POOLS
# ══════════════════════════════════════════════════════════════════════════

FIRST_NAMES = [
    "Aarav", "Aditi", "Ajay", "Akash", "Amit", "Ananya", "Anjali", "Arjun",
    "Bhavna", "Chetan", "Deepak", "Deepika", "Divya", "Gaurav", "Geeta",
    "Harish", "Isha", "Jayesh", "Kiran", "Komal", "Lavanya", "Mahesh",
    "Manish", "Meera", "Mohan", "Nandini", "Neha", "Nikhil", "Pallavi",
    "Pooja", "Pradeep", "Priya", "Rahul", "Rajesh", "Ramesh", "Ravi",
    "Rekha", "Rohan", "Rohit", "Roshni", "Sana", "Sandeep", "Sanjay",
    "Seema", "Shikha", "Shiv", "Shreya", "Siddharth", "Smita", "Sneha",
    "Suresh", "Tanvi", "Tarun", "Uday", "Uma", "Varun", "Veena",
    "Vikram", "Vinay", "Vishal", "Yamini", "Yash", "Zara", "Zubin",
]

LAST_NAMES = [
    "Agarwal", "Bose", "Chauhan", "Desai", "Gandhi", "Gupta", "Iyer",
    "Jain", "Joshi", "Kapoor", "Khanna", "Kumar", "Malhotra", "Mehta",
    "Mishra", "Nair", "Patel", "Pillai", "Rao", "Reddy", "Saxena",
    "Shah", "Sharma", "Singh", "Sinha", "Srivastava", "Trivedi", "Verma",
]

ALL_EMPLOYMENT = ["salaried", "self_employed", "business", "professional", "contract"]

# ══════════════════════════════════════════════════════════════════════════
#  PIPELINE FUNCTIONS  (self-contained copies — no import from routes/)
# ══════════════════════════════════════════════════════════════════════════

def _emi(principal: float, annual_rate: float, months: int) -> float:
    """Reducing-balance EMI."""
    if months <= 0 or principal <= 0:
        return 0.0
    r = annual_rate / 12
    if r == 0:
        return principal / months
    return principal * r * (1 + r) ** months / ((1 + r) ** months - 1)


def run_eligibility(app: Application, product: dict) -> None:
    reasons = []

    # Rule 1 — Age 21–60
    if 21 <= app.age <= 60:
        reasons.append({"rule": "age", "status": "PASS"})
    else:
        reasons.append({"rule": "age",    "status": "FAIL",
                        "detail": f"Age {app.age} outside 21–60"})

    # Rule 2 — Loan ends by retirement age 65
    end_age = app.age + app.tenure_months / 12
    if end_age <= RETIREMENT_AGE:
        reasons.append({"rule": "retirement_age", "status": "PASS"})
    else:
        reasons.append({"rule": "retirement_age", "status": "FAIL",
                        "detail": (f"Loan would end at age {end_age:.1f}; "
                                   f"must end by age {RETIREMENT_AGE}")})

    # Rule 3 — Income ≥ product minimum
    if app.monthly_income >= product["min_income"]:
        reasons.append({"rule": "income", "status": "PASS"})
    else:
        reasons.append({"rule": "income", "status": "FAIL",
                        "detail": (f"Income ₹{app.monthly_income:,.0f} < "
                                   f"min ₹{product['min_income']:,.0f} for {app.loan_type}")})

    # Rule 4 — Employment type allowed for this loan type
    allowed = ALLOWED_EMPLOYMENT.get(app.loan_type, [])
    if app.employment_type in allowed:
        reasons.append({"rule": "employment", "status": "PASS"})
    else:
        reasons.append({"rule": "employment", "status": "FAIL",
                        "detail": (f"{app.employment_type} not eligible "
                                   f"for {app.loan_type} loan")})

    # Rule 5 — Existing EMI ≤ 40% of monthly income
    existing_emi_ratio = app.existing_emi / app.monthly_income
    if existing_emi_ratio <= MAX_EMI_RATIO:
        reasons.append({"rule": "existing_emi", "status": "PASS"})
    else:
        reasons.append({"rule": "existing_emi", "status": "FAIL",
                        "detail": (f"Existing EMI is {existing_emi_ratio:.1%} "
                                   f"of income; maximum is {MAX_EMI_RATIO:.0%}")})

    # Rule 6 — Requested tenure ≤ product maximum
    if app.tenure_months <= product["max_tenure_months"]:
        reasons.append({"rule": "tenure", "status": "PASS"})
    else:
        reasons.append({"rule": "tenure", "status": "FAIL",
                        "detail": (f"Tenure {app.tenure_months} months exceeds "
                                   f"maximum {product['max_tenure_months']} months")})

    any_fail = any(r["status"] == "FAIL" for r in reasons)
    app.eligibility_status  = "FAIL" if any_fail else "PASS"
    app.eligibility_reasons = json.dumps(reasons)


def run_scoring(app: Application, product: dict) -> None:
    app.emi_amount = _emi(app.loan_amount, product["interest_rate"], app.tenure_months)
    app.emi_ratio  = (app.emi_amount + app.existing_emi) / app.monthly_income

    if (app.eligibility_status == "PASS"
            and app.emi_ratio < 0.40
            and app.credit_score > 700):
        app.recommendation = "Approve"
    elif app.emi_ratio > 0.60 or app.eligibility_status == "FAIL":
        app.recommendation = "Reject"
    else:
        app.recommendation = "Review"


def run_explain(app: Application) -> None:
    ratio_pct = (app.emi_ratio or 0) * 100
    app.explanation_text = (
        f"{app.name} applied for a ₹{app.loan_amount:,.0f} {app.loan_type} loan over "
        f"{app.tenure_months} months. Their total EMI burden would be "
        f"{ratio_pct:.1f}% of monthly income "
        f"(₹{app.emi_amount:,.0f} new EMI + ₹{app.existing_emi:,.0f} existing EMI). "
        f"Credit score: {app.credit_score}. "
        f"Eligibility: {app.eligibility_status}. "
        f"Decision: {app.recommendation}."
    )
    app.priority_rank = {"Review": 1, "Reject": 2, "Approve": 3}.get(app.recommendation, 9)


def run_gap(app: Application, product: dict) -> None:
    if app.recommendation == "Approve":
        app.gap_to_approval = json.dumps({"status": "already_approved"})
        return

    candidates = []
    for amt_cut in [0.00, 0.10, 0.20, 0.30]:
        for extra_months in [0, 12, 24, 36]:
            if amt_cut == 0.00 and extra_months == 0:
                continue  # skip the "no change" scenario
            new_amount = app.loan_amount * (1 - amt_cut)
            new_tenure = app.tenure_months + extra_months
            # Clamp tenure to product max
            new_tenure = min(new_tenure, product["max_tenure_months"])
            new_emi    = _emi(new_amount, product["interest_rate"], new_tenure)
            new_ratio  = (new_emi + app.existing_emi) / app.monthly_income
            flips_to_approve = (
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
                "flips_to_approve":     flips_to_approve,
            })

    # Best candidate = smallest change that flips; fall back to "no path"
    winning = [c for c in candidates if c["flips_to_approve"]]
    winning.sort(key=lambda c: (c["amount_reduction_pct"], c["extra_months"]))

    if winning:
        app.gap_to_approval = json.dumps(winning[0])
    else:
        # Still return all scenarios so the UI can show partial improvement
        candidates.sort(key=lambda c: c["new_emi_ratio"])
        app.gap_to_approval = json.dumps({
            "status":     "no_path_found",
            "best_scenario": candidates[0] if candidates else None,
        })


def _run_full_pipeline(app: Application, products_by_type: dict) -> None:
    product = products_by_type[app.loan_type]
    run_eligibility(app, product)
    run_scoring(app, product)
    run_explain(app)
    run_gap(app, product)


# ══════════════════════════════════════════════════════════════════════════
#  APPLICATION PROFILE GENERATORS
# ══════════════════════════════════════════════════════════════════════════

def _rand_name() -> str:
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"


def make_strong_profile() -> dict:
    """Profiles almost certain to Approve: good income, low ratio, high credit."""
    loan_type = random.choice(["personal", "auto", "home", "education"])
    products_map = {p["loan_type"]: p for p in LOAN_PRODUCTS}
    product = products_map[loan_type]
    allowed_emp = ALLOWED_EMPLOYMENT[loan_type]

    # Income well above minimum
    monthly_income = random.randint(
        int(product["min_income"] * 1.5),
        int(product["min_income"] * 4)
    )
    # Low existing EMI
    existing_emi = random.randint(0, int(monthly_income * 0.10))
    # Loan amount: keep ratio low — aim for emi_ratio ~ 0.20–0.35
    # Back-calculate safe max loan amount
    safe_ratio    = random.uniform(0.18, 0.34)
    safe_emi_budget = safe_ratio * monthly_income - existing_emi
    tenure_months   = random.choice([24, 36, 48, 60, 84])
    tenure_months   = min(tenure_months, product["max_tenure_months"])
    r = product["interest_rate"] / 12
    # EMI = P*r*(1+r)^n / ((1+r)^n - 1)  →  P = EMI * ((1+r)^n-1) / (r*(1+r)^n)
    factor = ((1 + r) ** tenure_months - 1) / (r * (1 + r) ** tenure_months)
    loan_amount   = max(50_000, round(safe_emi_budget * factor, -3))
    credit_score  = random.randint(720, 850)
    age           = random.randint(25, 55)

    return dict(
        name=_rand_name(), age=age,
        employment_type=random.choice(allowed_emp),
        monthly_income=float(monthly_income),
        loan_type=loan_type, loan_amount=float(loan_amount),
        tenure_months=tenure_months, existing_emi=float(existing_emi),
        credit_score=credit_score,
    )


def make_borderline_profile() -> dict:
    """Profiles in the 0.40–0.60 ratio band, or credit 650–720 range → Review."""
    loan_type = random.choice(["personal", "auto", "education"])
    products_map = {p["loan_type"]: p for p in LOAN_PRODUCTS}
    product = products_map[loan_type]
    allowed_emp = ALLOWED_EMPLOYMENT[loan_type]

    monthly_income = random.randint(
        int(product["min_income"] * 1.0),
        int(product["min_income"] * 2.5)
    )
    existing_emi = random.randint(0, int(monthly_income * 0.20))
    # Target ratio 0.40–0.58
    target_ratio      = random.uniform(0.40, 0.58)
    emi_budget        = target_ratio * monthly_income - existing_emi
    tenure_months     = random.choice([36, 48, 60])
    tenure_months     = min(tenure_months, product["max_tenure_months"])
    r = product["interest_rate"] / 12
    factor = ((1 + r) ** tenure_months - 1) / (r * (1 + r) ** tenure_months)
    loan_amount  = max(50_000, round(emi_budget * factor, -3))
    # Credit score in borderline band — sometimes high, sometimes medium
    credit_score = random.choice([
        random.randint(650, 720),   # medium
        random.randint(701, 760),   # good but ratio too high
    ])
    age = random.randint(22, 58)

    return dict(
        name=_rand_name(), age=age,
        employment_type=random.choice(allowed_emp),
        monthly_income=float(monthly_income),
        loan_type=loan_type, loan_amount=float(loan_amount),
        tenure_months=tenure_months, existing_emi=float(existing_emi),
        credit_score=credit_score,
    )


def make_weak_profile() -> dict:
    """Profiles likely to Reject: fails one or more eligibility rules, or very high ratio."""
    strategy = random.choice(["high_ratio", "age_fail", "income_fail",
                               "employment_fail", "emi_ratio_fail"])

    loan_type  = random.choice(["personal", "auto", "home", "education"])
    products_map = {p["loan_type"]: p for p in LOAN_PRODUCTS}
    product    = products_map[loan_type]
    allowed_emp = ALLOWED_EMPLOYMENT[loan_type]

    # Defaults (sane)
    age            = random.randint(25, 50)
    employment_type = random.choice(allowed_emp)
    monthly_income = random.randint(int(product["min_income"] * 1.2),
                                    int(product["min_income"] * 2.5))
    existing_emi   = random.randint(0, 10_000)
    tenure_months  = random.choice([24, 36, 48])
    tenure_months  = min(tenure_months, product["max_tenure_months"])
    credit_score   = random.randint(580, 680)

    if strategy == "high_ratio":
        # Huge loan relative to income → ratio > 0.60
        target_ratio  = random.uniform(0.65, 0.90)
        r = product["interest_rate"] / 12
        factor = ((1 + r) ** tenure_months - 1) / (r * (1 + r) ** tenure_months)
        emi_budget  = target_ratio * monthly_income - existing_emi
        loan_amount = max(1_00_000, round(emi_budget * factor, -3))

    elif strategy == "age_fail":
        age         = random.choice([
            random.randint(17, 20),   # too young
            random.randint(61, 75),   # too old
        ])
        loan_amount = random.randint(1_00_000, 5_00_000)

    elif strategy == "income_fail":
        # Income below product minimum
        monthly_income = random.randint(5_000, int(product["min_income"] * 0.85))
        loan_amount    = random.randint(1_00_000, 3_00_000)

    elif strategy == "employment_fail":
        # Pick a disallowed employment type
        disallowed = [e for e in ALL_EMPLOYMENT if e not in allowed_emp]
        if not disallowed:                        # all allowed → force high ratio
            target_ratio  = random.uniform(0.65, 0.85)
            r = product["interest_rate"] / 12
            factor = ((1 + r) ** tenure_months - 1) / (r * (1 + r) ** tenure_months)
            emi_budget  = target_ratio * monthly_income
            loan_amount = max(1_00_000, round(emi_budget * factor, -3))
        else:
            employment_type = random.choice(disallowed)
            loan_amount     = random.randint(1_00_000, 4_00_000)

    elif strategy == "emi_ratio_fail":
        # Existing EMI above 40% of monthly income
        existing_emi = random.randint(
            max(1, math.ceil(monthly_income * 0.41)),
            max(2, math.ceil(monthly_income * 0.80)),
        )
        loan_amount  = random.randint(1_00_000, 4_00_000)

    else:
        loan_amount = random.randint(1_00_000, 4_00_000)

    return dict(
        name=_rand_name(), age=age,
        employment_type=employment_type,
        monthly_income=float(monthly_income),
        loan_type=loan_type, loan_amount=float(loan_amount),
        tenure_months=tenure_months, existing_emi=float(existing_emi),
        credit_score=credit_score,
    )


# ══════════════════════════════════════════════════════════════════════════
#  MAIN SEED LOGIC
# ══════════════════════════════════════════════════════════════════════════

def seed():
    print("🌱  Creating tables …")
    Base.metadata.drop_all(bind=engine)   # fresh start on re-run
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    products_by_type = {}

    # ── 1. Insert loan products ───────────────────────────────────────────
    print("📦  Inserting loan products …")
    for p in LOAN_PRODUCTS:
        prod = LoanProduct(**p)
        db.add(prod)
        products_by_type[p["loan_type"]] = p
    db.commit()
    print(f"   ✔  {len(LOAN_PRODUCTS)} loan products inserted")

    # ── 2. Build 100 application rows ────────────────────────────────────
    print("👥  Generating 100 applicant profiles …")
    profiles = (
        [make_strong_profile()     for _ in range(35)] +
        [make_borderline_profile() for _ in range(30)] +
        [make_weak_profile()       for _ in range(35)]
    )
    random.shuffle(profiles)   # mix ordering so the dashboard looks realistic

    apps = []
    for data in profiles:
        app = Application(**data)
        _run_full_pipeline(app, products_by_type)
        apps.append(app)

    db.add_all(apps)
    db.commit()

    # ── 3. Summary ────────────────────────────────────────────────────────
    total    = db.query(Application).count()
    approve  = db.query(Application).filter(Application.recommendation == "Approve").count()
    review   = db.query(Application).filter(Application.recommendation == "Review").count()
    reject   = db.query(Application).filter(Application.recommendation == "Reject").count()

    print(f"\n{'═'*52}")
    print(f"  ✅  Seed complete — {total} applications in loan.db")
    print(f"{'─'*52}")
    print(f"  Approve : {approve:>3}  ({approve/total*100:.0f}%)")
    print(f"  Review  : {review:>3}  ({review/total*100:.0f}%)")
    print(f"  Reject  : {reject:>3}  ({reject/total*100:.0f}%)")
    print(f"{'═'*52}")

    # ── 4. Quick sanity-check sample ──────────────────────────────────────
    print("\n📋  Sample rows (first 5):\n")
    samples = db.query(Application).limit(5).all()
    for s in samples:
        print(f"  [{s.app_id:>3}] {s.name:<28} "
              f"{s.loan_type:<12} "
              f"₹{s.loan_amount:>10,.0f}  "
              f"ratio={s.emi_ratio:.2f}  "
              f"score={s.credit_score}  "
              f"→ {s.recommendation}")

    db.close()
    print("\n🚀  Run: uvicorn main:app --reload   to start the API")


if __name__ == "__main__":
    seed()
