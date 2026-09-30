import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from database import SessionLocal
from models import Application, LoanProduct
from sqlalchemy import func

db = SessionLocal()

print("=== LOAN PRODUCTS ===")
for p in db.query(LoanProduct).all():
    print(f"  {p.loan_type:<12}  rate={p.interest_rate*100:.1f}%  "
          f"min_income=Rs.{p.min_income:,.0f}  max_tenure={p.max_tenure_months}mo")

print()
print("=== DISTRIBUTION BY RECOMMENDATION x LOAN TYPE ===")
rows = (db.query(Application.loan_type, Application.recommendation, func.count())
          .group_by(Application.loan_type, Application.recommendation)
          .order_by(Application.loan_type, Application.recommendation)
          .all())
print(f"  {'Loan Type':<12}  {'Decision':<8}  Count")
print(f"  {'-'*12}  {'-'*8}  -----")
for loan_type, rec, cnt in rows:
    print(f"  {loan_type:<12}  {rec:<8}  {cnt}")

print()
print("=== TOTALS ===")
total   = db.query(Application).count()
approve = db.query(Application).filter(Application.recommendation == "Approve").count()
review  = db.query(Application).filter(Application.recommendation == "Review").count()
reject  = db.query(Application).filter(Application.recommendation == "Reject").count()
print(f"  Total={total}  Approve={approve}  Review={review}  Reject={reject}")

print()
print("=== ELIGIBILITY RULE FAILURES ===")
apps = db.query(Application).all()
rule_fails = {}
for app in apps:
    reasons = json.loads(app.eligibility_reasons or "[]")
    for r in reasons:
        if r["status"] == "FAIL":
            rule_fails[r["rule"]] = rule_fails.get(r["rule"], 0) + 1
for rule, cnt in sorted(rule_fails.items()):
    print(f"  {rule:<20}  {cnt} apps failed")

print()
print("=== SAMPLE: 3 each of Approve / Review / Reject ===")
for rec in ["Approve", "Review", "Reject"]:
    print(f"-- {rec} --")
    for app in db.query(Application).filter(Application.recommendation == rec).limit(3).all():
        gap = json.loads(app.gap_to_approval or "{}")
        if "status" in gap:
            gap_str = gap["status"]
        else:
            gap_str = f"-{gap.get('amount_reduction_pct',0)}% amt +{gap.get('extra_months',0)}mo"
        print(f"  {app.name:<28} score={app.credit_score}  "
              f"ratio={app.emi_ratio:.2f}  gap={gap_str}")

db.close()
