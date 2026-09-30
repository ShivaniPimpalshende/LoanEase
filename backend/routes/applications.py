"""
routes/applications.py — F1 + F4 CRUD
POST   /applications              Submit new application (triggers full pipeline)
GET    /applications              List all (with optional filters + sorting)
GET    /applications/{id}         Single application detail
PUT    /applications/{id}/override Officer manual override
GET    /stats                     Counts by status + approval rate by loan_type
GET    /loan-products             Loan product list (for F1 dropdowns)
"""
import json
import os
import re
import urllib.error
import urllib.request
import httpx
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Application, LoanProduct, Notification, StatusHistory
from schemas import ApplicationCreate, ApplicationOut, OverrideRequest, StatsOut, LoanProductOut, TermsRequest, ChatRequest
from routes.eligibility import run_eligibility
from routes.scoring import run_scoring
from routes.explain import run_explain, run_gap

router = APIRouter()

SORTABLE_FIELDS = {
    "app_id", "name", "loan_type", "loan_amount", "monthly_income", "credit_score",
    "emi_ratio", "recommendation", "priority_rank",
}

POLICY_DOCS = [
    ("Age and basic eligibility", "Applicants must be between 21 and 60. Employment must be an accepted type for the selected loan product."),
    ("EMI ratio thresholds", "Total EMI divided by monthly income below 40% supports approval; 40% to 60% usually needs officer review; above 60% is rejected."),
    ("Credit score benchmark", "A credit score above 700 is required for automated approval. Lower scores may require officer review or rejection."),
    ("Loan tenure rules", "Each loan product has a maximum tenure, and the loan must finish by the applicant's age 65 retirement limit."),
    ("How to improve", "Reducing the loan amount, extending tenure within product limits, or reducing existing EMIs can improve the EMI ratio."),
    ("Required documents", "Typical verification documents include identity proof, recent salary slips or income tax returns, and recent bank statements."),
]


# ── Helper: run the full F2+F3+F5 pipeline on an Application row ────────────
def _run_pipeline(app: Application, db: Session) -> None:
    run_eligibility(app, db)
    run_scoring(app, db)
    run_gap(app, db)
    # Automated scoring is used to calculate EMI and gap data, but the
    # applicant remains pending until an officer makes the final decision.
    app.recommendation = "Pending"
    run_explain(app, db)


def _to_out(app: Application) -> ApplicationOut:
    return ApplicationOut.from_orm_obj(app)


def _simulate_terms(app: Application, db: Session, payload: TermsRequest) -> dict:
    """Run the existing pipeline against proposed terms without persisting them."""
    product_type = payload.loan_type or app.loan_type
    product = db.query(LoanProduct).filter(LoanProduct.loan_type == product_type).first()
    if product is None:
        raise HTTPException(status_code=422, detail=f"Unknown loan_type: {product_type}")

    amount = payload.loan_amount if payload.loan_amount is not None else app.loan_amount
    tenure = payload.tenure_months if payload.tenure_months is not None else app.tenure_months
    if tenure > product.max_tenure_months:
        raise HTTPException(
            status_code=422,
            detail=f"tenure_months cannot exceed {product.max_tenure_months} months for a {product_type} loan",
        )

    simulated = Application(
        app_id=app.app_id,
        name=app.name, age=app.age, employment_type=app.employment_type,
        monthly_income=app.monthly_income, loan_type=product_type,
        loan_amount=amount, tenure_months=tenure,
        existing_emi=app.existing_emi, credit_score=app.credit_score,
    )
    run_eligibility(simulated, db)
    run_scoring(simulated, db)
    run_explain(simulated, db)
    run_gap(simulated, db)
    result = _to_out(simulated).model_dump()
    result["simulation"] = True
    return result


def _parse_chat_terms(message: str) -> dict:
    lowered = message.lower()
    terms = {}
    lakh = re.search(r"(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|l)\b", lowered)
    thousand = re.search(r"(\d+(?:\.\d+)?)\s*k\b", lowered)
    amount = re.search(r"(?:₹|rs\.?\s*)?(\d{5,8})\b", lowered)
    months = re.search(r"(\d+)\s*(?:month|months|m)\b", lowered)
    years = re.search(r"(\d+)\s*(?:year|years|yr|yrs)\b", lowered)
    if lakh:
        terms["loan_amount"] = float(lakh.group(1)) * 100000
    elif thousand:
        terms["loan_amount"] = float(thousand.group(1)) * 1000
    elif amount:
        terms["loan_amount"] = float(amount.group(1))
    if months:
        terms["tenure_months"] = int(months.group(1))
    elif years:
        terms["tenure_months"] = int(years.group(1)) * 12
    return terms


def _chat_source(message: str) -> tuple[str, str]:
    lowered = message.lower()
    scores = []
    for title, content in POLICY_DOCS:
        score = sum(1 for word in re.findall(r"[a-z]+", lowered) if len(word) > 3 and word in content.lower())
        scores.append((score, title, content))
    _, title, content = max(scores, key=lambda item: item[0])
    return title, content


def inr_chat(value: float) -> str:
    return f"₹{value:,.0f}"


def _groq_reply(app: Application, message: str, fallback: str, what_if_result: Optional[dict]) -> str:
    """Ask Groq for a grounded response, falling back to the deterministic reply."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return fallback

    what_if_context = ""
    if what_if_result:
        what_if_context = (
            f"Simulated amount: {inr_chat(what_if_result['loan_amount'])}; "
            f"tenure: {what_if_result['tenure_months']} months; "
            f"EMI: {inr_chat(what_if_result['emi_amount'])}; "
            f"ratio: {what_if_result['emi_ratio'] * 100:.1f}%; "
            f"outcome: {what_if_result['recommendation']}."
        )
    prompt = (
        "You are a concise loan application assistant. Answer only from the supplied facts. "
        "Never invent personal data, promise approval, or change a decision. "
        "State that an officer makes the final decision when relevant.\n\n"
        f"Applicant: {app.name}; loan: {app.loan_type}; amount: {inr_chat(app.loan_amount)}; "
        f"tenure: {app.tenure_months} months; status: {app.recommendation}; "
        f"eligibility: {app.eligibility_status}; EMI: {inr_chat(app.emi_amount or 0)}; "
        f"EMI ratio: {(app.emi_ratio or 0) * 100:.1f}%.\n"
        f"{what_if_context}\n"
        f"User question: {message}\n"
        f"Deterministic fallback facts: {fallback}"
    )
    model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
    try:
        response = httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.2,
                "max_tokens": 250,
            },
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "LoanScreenAI/1.0",
            },
            timeout=8.0,
        )
        if response.status_code == 200:
            data = response.json()
            content = data["choices"][0]["message"]["content"].strip()
            if content:
                print("[GROQ] chatbot response received")
                return content
        else:
            print(f"[GROQ ERROR] HTTP {response.status_code}: {response.text}")
    except Exception as exc:
        print(f"[GROQ FALLBACK] {exc}")
    return fallback


# ── F1: Submit new application ───────────────────────────────────────────────
@router.post("/", response_model=ApplicationOut, status_code=201)
def create_application(
    payload: ApplicationCreate,
    db: Session = Depends(get_db),
):
    # Validate loan type exists
    product = db.query(LoanProduct).filter(
        LoanProduct.loan_type == payload.loan_type
    ).first()
    if not product:
        raise HTTPException(status_code=422, detail=f"Unknown loan_type: {payload.loan_type}")
    if payload.tenure_months > product.max_tenure_months:
        raise HTTPException(
            status_code=422,
            detail=(
                f"tenure_months cannot exceed {product.max_tenure_months} months "
                f"for a {payload.loan_type} loan"
            ),
        )

    app = Application(**payload.model_dump())
    db.add(app)
    db.flush()          # get app_id without committing
    _run_pipeline(app, db)
    db.add(StatusHistory(
        app_id=app.app_id, old_status="Submitted", new_status=app.recommendation,
        changed_by="system",
    ))
    db.commit()
    db.refresh(app)
    return _to_out(app)


# ── F4: List all applications (with filtering + sorting) ────────────────────
@router.get("/", response_model=list[ApplicationOut])
def list_applications(
    status:    Optional[str] = Query(None, description="Pending | Approve | Review | Reject"),
    loan_type: Optional[str] = Query(None),
    sort_by:   str           = Query("priority_rank", description="Field to sort by"),
    order:     str           = Query("asc", description="asc | desc"),
    db: Session = Depends(get_db),
):
    q = db.query(Application)
    if status:
        q = q.filter(Application.recommendation == status)
    if loan_type:
        q = q.filter(Application.loan_type == loan_type)

    if sort_by not in SORTABLE_FIELDS:
        raise HTTPException(status_code=422, detail=f"Unsupported sort field: {sort_by}")
    col = getattr(Application, sort_by)
    q = q.order_by(col.asc() if order == "asc" else col.desc())

    return [_to_out(a) for a in q.all()]


# ── F4: Single application detail ───────────────────────────────────────────
@router.get("/{app_id}", response_model=ApplicationOut)
def get_application(app_id: int, db: Session = Depends(get_db)):
    app = db.get(Application, app_id)
    if app is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return _to_out(app)


# ── F4: Officer manual override ──────────────────────────────────────────────
@router.put("/{app_id}/override", response_model=ApplicationOut)
def override_application(
    app_id: int,
    payload: OverrideRequest,
    db: Session = Depends(get_db),
):
    app = db.get(Application, app_id)
    if app is None:
        raise HTTPException(status_code=404, detail="Application not found")

    old_recommendation = app.recommendation
    app.recommendation = payload.recommendation
    # Recompute all recommendation-dependent derived fields after the override.
    run_explain(app, db)
    run_gap(app, db)
    if old_recommendation != app.recommendation:
        db.add(StatusHistory(
            app_id=app.app_id, old_status=old_recommendation,
            new_status=app.recommendation, changed_by="officer",
        ))
    db.commit()
    db.refresh(app)
    return _to_out(app)


@router.get("/{app_id}/history")
def get_application_history(app_id: int, db: Session = Depends(get_db)):
    if db.get(Application, app_id) is None:
        raise HTTPException(status_code=404, detail="Application not found")
    rows = db.query(StatusHistory).filter(
        StatusHistory.app_id == app_id
    ).order_by(StatusHistory.history_id.asc()).all()
    return [
        {
            "history_id": row.history_id,
            "old_status": row.old_status,
            "new_status": row.new_status,
            "changed_by": row.changed_by,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]


@router.get("/meta/notifications")
def list_notifications(db: Session = Depends(get_db)):
    rows = db.query(Notification, Application.name).join(
        Application, Application.app_id == Notification.app_id
    ).order_by(Notification.sent_at.desc()).all()
    return [
        {
            "notification_id": notification.notification_id,
            "app_id": notification.app_id,
            "applicant_name": name,
            "channel": notification.channel,
            "message": notification.message,
            "delivery_status": notification.delivery_status,
            "sent_at": notification.sent_at.isoformat(),
        }
        for notification, name in rows
    ]


@router.post("/{app_id}/what-if")
def simulate_application_terms(
    app_id: int,
    payload: TermsRequest,
    db: Session = Depends(get_db),
):
    app = db.get(Application, app_id)
    if app is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return _simulate_terms(app, db, payload)


@router.post("/{app_id}/chat")
def application_guidance_chat(
    app_id: int,
    payload: ChatRequest,
    db: Session = Depends(get_db),
):
    app = db.get(Application, app_id)
    if app is None:
        raise HTTPException(status_code=404, detail="Application not found")

    terms = _parse_chat_terms(payload.message)
    what_if_result = None
    sources = []
    if terms:
        what_if_result = _simulate_terms(app, db, TermsRequest(**terms))
        reply = (
            f"For a simulated {inr_chat(what_if_result['loan_amount'])} loan over "
            f"{what_if_result['tenure_months']} months, the estimated EMI is "
            f"{inr_chat(what_if_result['emi_amount'])} and the EMI ratio is "
            f"{what_if_result['emi_ratio'] * 100:.1f}%. The simulated outcome is "
            f"{what_if_result['recommendation']}. The credit officer makes the final decision."
        )
        sources.append("Interactive what-if term calculations")
    else:
        lowered = payload.message.lower()
        if any(phrase in lowered for phrase in ("hello", "hi", "hey", "good morning", "good evening", "how are you")):
            reply = "Hello! I can help with your application status, eligibility, EMI, loan details, policy questions, and what-if loan simulations."
        elif any(phrase in lowered for phrase in ("help", "what can you do", "what can i ask")):
            reply = "You can ask about your name, loan type, amount, tenure, EMI, eligibility, status, available loan types, or try a question like: What if I take ₹5 lakh for 48 months?"
        elif any(phrase in lowered for phrase in ("what is my name", "whats my name", "who am i", "my name")):
            reply = f"Your name is {app.name}."
        elif any(phrase in lowered for phrase in ("how many types of loan", "how many type of loan", "how many loan types", "types of loans", "loan categories", "which loans are available")):
            reply = "There are four loan types available: Personal, Home, Auto, and Education loans. Each has its own interest rate, minimum income, and maximum tenure."
            sources.append("Available loan products")
        elif any(phrase in lowered for phrase in ("what loan", "loan type", "which loan", "my product")):
            reply = f"You applied for a {app.loan_type} loan."
        elif any(phrase in lowered for phrase in ("how much", "loan amount", "amount applied", "borrow")):
            reply = f"Your requested loan amount is {inr_chat(app.loan_amount)}."
        elif any(phrase in lowered for phrase in ("tenure", "how long", "loan period", "months")):
            reply = f"Your loan tenure is {app.tenure_months} months."
        elif any(phrase in lowered for phrase in ("emi", "monthly payment", "monthly installment")):
            reply = f"Your estimated monthly EMI is {inr_chat(app.emi_amount)} and your total EMI ratio is {(app.emi_ratio or 0) * 100:.1f}%."
        elif any(phrase in lowered for phrase in ("what are the eligibility rules", "what are the rules", "list the rules", "explain the rules")):
            reply = "The six eligibility checks are: age 21–60, minimum income for the loan type, accepted employment type, existing EMI no higher than 40% of income, product maximum tenure, and loan completion by age 65."
            sources.append("Age and basic eligibility")
        elif any(phrase in lowered for phrase in ("eligible", "eligibility", "qualify")):
            passed = [reason["rule"].replace("_", " ") for reason in json.loads(app.eligibility_reasons or "[]") if reason["status"] == "PASS"]
            failed = [reason["rule"].replace("_", " ") for reason in json.loads(app.eligibility_reasons or "[]") if reason["status"] == "FAIL"]
            reply = f"Eligibility is {app.eligibility_status}. Passed checks: {', '.join(passed) or 'none'}."
            if failed:
                reply += f" Failed checks: {', '.join(failed)}."
        elif any(word in lowered for word in ("why", "reject", "review", "status", "decision")):
            reply = (
                f"Your current application status is {app.recommendation}. "
                f"{app.explanation_text or 'The application is being evaluated against the eligibility and scoring rules.'} "
                f"{app.gap_to_approval and 'Guidance is available in the gap-to-approval analysis.' or ''}"
            )
        else:
            title, content = _chat_source(payload.message)
            query_words = {word for word in re.findall(r"[a-z]+", lowered) if len(word) > 3}
            policy_words = {word for word in re.findall(r"[a-z]+", content.lower()) if len(word) > 3}
            if query_words & policy_words:
                sources.append(title)
                reply = f"According to {title}: {content} For your application, the current status is {app.recommendation}."
            else:
                reply = "I can answer questions about your loan application, eligibility rules, EMI, loan products, status, and what-if term calculations. Please ask one of those questions."
    reply = _groq_reply(app, payload.message, reply, what_if_result)
    return {"reply": reply, "sources": sources, "whatif_result": what_if_result}


@router.put("/{app_id}/terms", response_model=ApplicationOut)
def apply_application_terms(
    app_id: int,
    payload: TermsRequest,
    db: Session = Depends(get_db),
):
    app = db.get(Application, app_id)
    if app is None:
        raise HTTPException(status_code=404, detail="Application not found")
    old_recommendation = app.recommendation
    if payload.loan_type is not None:
        app.loan_type = payload.loan_type
    if payload.loan_amount is not None:
        app.loan_amount = payload.loan_amount
    if payload.tenure_months is not None:
        app.tenure_months = payload.tenure_months

    product = db.query(LoanProduct).filter(LoanProduct.loan_type == app.loan_type).first()
    if product is None:
        raise HTTPException(status_code=422, detail=f"Unknown loan_type: {app.loan_type}")
    if app.tenure_months > product.max_tenure_months:
        raise HTTPException(status_code=422, detail=f"Tenure exceeds the maximum for a {app.loan_type} loan")

    run_eligibility(app, db)
    run_scoring(app, db)
    run_explain(app, db)
    run_gap(app, db)
    if old_recommendation != app.recommendation:
        db.add(StatusHistory(
            app_id=app.app_id, old_status=old_recommendation,
            new_status=app.recommendation, changed_by="officer",
        ))
    db.commit()
    db.refresh(app)
    return _to_out(app)


# ── Stats endpoint ───────────────────────────────────────────────────────────
@router.get("/meta/stats", response_model=StatsOut)
def get_stats(db: Session = Depends(get_db)):
    total   = db.query(Application).count()
    pending = db.query(Application).filter(Application.recommendation == "Pending").count()
    approve = db.query(Application).filter(Application.recommendation == "Approve").count()
    review  = db.query(Application).filter(Application.recommendation == "Review").count()
    reject  = db.query(Application).filter(Application.recommendation == "Reject").count()

    # Approval rate per loan type
    by_loan_type = []
    for (lt,) in db.query(Application.loan_type).distinct().all():
        lt_total   = db.query(Application).filter(Application.loan_type == lt).count()
        lt_approve = db.query(Application).filter(
            Application.loan_type == lt,
            Application.recommendation == "Approve",
        ).count()
        by_loan_type.append({
            "loan_type":     lt,
            "total":         lt_total,
            "approve":       lt_approve,
            "approval_rate": round(lt_approve / lt_total * 100, 1) if lt_total else 0,
        })

    return StatsOut(
        total=total, pending=pending, approve=approve, review=review, reject=reject,
        by_loan_type=sorted(by_loan_type, key=lambda x: x["loan_type"]),
    )


# ── Loan products (for F1 dropdowns) ────────────────────────────────────────
@router.get("/meta/loan-products", response_model=list[LoanProductOut])
def list_loan_products(db: Session = Depends(get_db)):
    return db.query(LoanProduct).all()
