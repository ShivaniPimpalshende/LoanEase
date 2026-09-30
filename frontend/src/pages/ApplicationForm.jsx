import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User, Briefcase, CreditCard, DollarSign,
  Calendar, TrendingDown, Hash, CheckCircle2, AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../api";

const EMPLOYMENT_TYPES = [
  { value: "salaried",     label: "Salaried" },
  { value: "self_employed",label: "Self-Employed" },
  { value: "business",     label: "Business Owner" },
  { value: "professional", label: "Professional" },
  { value: "contract",     label: "Contract / Freelance" },
];

// Initial form state
const EMPTY = {
  name: "", age: "", employment_type: "salaried",
  monthly_income: "", loan_type: "personal",
  loan_amount: "", tenure_months: "", existing_emi: "", credit_score: "",
};

// Per-field validation rules
const RULES = {
  name:           { required: true, minLen: 2,   label: "Full Name" },
  age:            { required: true, min: 18, max: 100, label: "Age", type: "int" },
  monthly_income: { required: true, min: 1,       label: "Monthly Income", type: "float" },
  loan_amount:    { required: true, min: 1,       label: "Loan Amount", type: "float" },
  tenure_months:  { required: true, min: 1, max: 360, label: "Tenure", type: "int" },
  existing_emi:   { required: false, min: 0,      label: "Existing EMI", type: "float" },
  credit_score:   { required: true, min: 300, max: 900, label: "Credit Score", type: "int" },
};

function validate(form, loanProducts = []) {
  const errors = {};
  for (const [field, rule] of Object.entries(RULES)) {
    const raw = form[field];
    const selectedProduct = loanProducts.find((p) => p.loan_type === form.loan_type);
    const max = field === "tenure_months" && selectedProduct
      ? selectedProduct.max_tenure_months
      : rule.max;
    if (rule.required && (raw === "" || raw == null)) {
      errors[field] = `${rule.label} is required`;
      continue;
    }
    if (raw === "" || raw == null) continue;
    const num = Number(raw);
    if ((rule.type === "int" || rule.type === "float") && isNaN(num)) {
      errors[field] = `${rule.label} must be a number`;
      continue;
    }
    if (rule.type === "int" && !Number.isInteger(num)) {
      errors[field] = `${rule.label} must be a whole number`;
      continue;
    }
    if (rule.min != null && num < rule.min) {
      errors[field] = `${rule.label} must be ≥ ${rule.min}`;
      continue;
    }
    if (max != null && num > max) {
      errors[field] = `${rule.label} must be ≤ ${max}`;
      continue;
    }
    if (rule.minLen != null && String(raw).trim().length < rule.minLen) {
      errors[field] = `${rule.label} is too short`;
    }
  }
  return errors;
}

function Field({ name, label, icon: Icon, type = "text", placeholder, children, controller }) {
  const { form, errors, touched, onChange, onBlur } = controller;

  return (
    <div className="form-group">
      <label htmlFor={name}>
        {Icon && <Icon size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />}
        {label}
      </label>
      {children || (
        <input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          value={form[name]}
          onChange={onChange}
          onBlur={onBlur}
          className={touched[name] && errors[name] ? "error" : ""}
        />
      )}
      {touched[name] && errors[name] && (
        <div className="error-msg">
          <AlertCircle size={11} />
          {errors[name]}
        </div>
      )}
    </div>
  );
}

export default function ApplicationForm() {
  const navigate = useNavigate();
  const [form, setForm]       = useState(EMPTY);
  const [errors, setErrors]   = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [loanProducts, setLoanProducts] = useState([]);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.getLoanProducts().then(({ data }) => setLoanProducts(data)).catch(() => {});
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    // Re-validate this field if already touched
    if (touched[name]) {
      const errs = validate({ ...form, [name]: value }, loanProducts);
      setErrors((prev) => ({ ...prev, [name]: errs[name] }));
    }
  }

  function handleBlur(e) {
    const { name } = e.target;
    setTouched((t) => ({ ...t, [name]: true }));
    const errs = validate(form, loanProducts);
    setErrors((prev) => ({ ...prev, [name]: errs[name] }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    // Mark all fields as touched
    const allTouched = Object.fromEntries(Object.keys(EMPTY).map((k) => [k, true]));
    setTouched(allTouched);

    const errs = validate(form, loanProducts);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Please fix validation errors before submitting");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        age:           Number(form.age),
        monthly_income:Number(form.monthly_income),
        loan_amount:   Number(form.loan_amount),
        tenure_months: Number(form.tenure_months),
        existing_emi:  Number(form.existing_emi || 0),
        credit_score:  Number(form.credit_score),
      };
      const { data } = await api.submitApp(payload);
      setResult(data);
      localStorage.setItem("demo_app_id", String(data.app_id));
      toast.success("Application submitted and screened!");
      // Store new app ID so dashboard can highlight it
      sessionStorage.setItem("new_app_id", String(data.app_id));
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (Array.isArray(detail)) {
        // Pydantic validation errors
        const newErrs = {};
        detail.forEach((d) => {
          const field = d.loc?.[d.loc.length - 1];
          if (field) newErrs[field] = d.msg;
        });
        setErrors(newErrs);
        toast.error("Check the highlighted fields");
      } else {
        toast.error(typeof detail === "string" ? detail : "Submission failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function goToDashboard() {
    navigate("/");
  }

  // ── Result screen ──────────────────────────────────────────────────────
  if (result) {
    const recColor =
      result.recommendation === "Approve" ? "var(--approve-text)"
      : result.recommendation === "Review"  ? "var(--review-text)"
      : result.recommendation === "Pending" ? "var(--accent-blue)"
      : "var(--reject-text)";
    const recEmoji =
      result.recommendation === "Approve" ? "✅"
      : result.recommendation === "Review"  ? "⏳"
      : result.recommendation === "Pending" ? "🕒"
      : "❌";

    return (
      <div className="main-content fade-in" style={{ maxWidth: 700, paddingTop: "2rem" }}>
        <div className="card" style={{ textAlign: "center", padding: "2.5rem 2rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>{recEmoji}</div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: "0.25rem" }}>
            Application #{result.app_id} Screened
          </h2>
          <div
            style={{
              fontSize: "1.8rem", fontWeight: 900,
              color: recColor, margin: "0.5rem 0 1rem",
            }}
          >
            {result.recommendation === "Pending" ? "Pending officer review" : result.recommendation}
          </div>
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
            {result.explanation_text}
          </p>

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={goToDashboard}>
              View in Dashboard
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => { setResult(null); setForm(EMPTY); setTouched({}); setErrors({}); }}
            >
              Submit Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Lookup selected product for helper text
  const selectedProduct = loanProducts.find((p) => p.loan_type === form.loan_type);
  const fieldController = { form, errors, touched, onChange: handleChange, onBlur: handleBlur };

  return (
    <div className="main-content fade-in" style={{ maxWidth: 900, paddingTop: "1.5rem" }}>
      <div className="page-header" style={{ paddingTop: "0.5rem" }}>
        <div>
          <h1 className="page-title">New Application</h1>
          <p className="page-sub">Fill in all applicant details — results are instant</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="card">
          {/* Personal Details */}
          <div className="form-section-title">Personal Details</div>
          <div className="form-grid" style={{ marginBottom: "1.5rem" }}>
            <Field controller={fieldController} name="name" label="Full Name" icon={User} placeholder="e.g. Priya Sharma" />
            <Field controller={fieldController} name="age" label="Age (18–100)" icon={Hash} type="number" placeholder="e.g. 32" />
            <Field controller={fieldController} name="employment_type" label="Employment Type" icon={Briefcase}>
              <select
                id="employment_type" name="employment_type"
                value={form.employment_type} onChange={handleChange}
                className={touched.employment_type && errors.employment_type ? "error" : ""}
              >
                {EMPLOYMENT_TYPES.map((e) => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </Field>
            <Field controller={fieldController} name="monthly_income" label="Monthly Income (₹)" icon={DollarSign} type="number" placeholder="e.g. 75000" />
            <Field controller={fieldController} name="credit_score" label="Credit Score (300–900)" icon={CreditCard} type="number" placeholder="e.g. 720" />
          </div>

          {/* Loan Details */}
          <div className="form-section-title">Loan Details</div>
          <div className="form-grid" style={{ marginBottom: "0.5rem" }}>
            <Field controller={fieldController} name="loan_type" label="Loan Type" icon={Briefcase}>
              <select
                id="loan_type" name="loan_type"
                value={form.loan_type} onChange={handleChange}
              >
                {loanProducts.length > 0
                  ? loanProducts.map((p) => (
                      <option key={p.loan_type} value={p.loan_type} style={{ textTransform: "capitalize" }}>
                        {p.loan_type.charAt(0).toUpperCase() + p.loan_type.slice(1)}
                        {" "}({(p.interest_rate * 100).toFixed(1)}% p.a.)
                      </option>
                    ))
                  : ["personal", "home", "auto", "education"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))
                }
              </select>
              {selectedProduct && (
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 4 }}>
                  Min income: ₹{selectedProduct.min_income.toLocaleString("en-IN")} ·
                  Max tenure: {selectedProduct.max_tenure_months} months
                </div>
              )}
            </Field>
            <Field controller={fieldController} name="loan_amount" label="Loan Amount (₹)" icon={DollarSign} type="number" placeholder="e.g. 500000" />
            <Field controller={fieldController} name="tenure_months" label="Tenure (months)" icon={Calendar} type="number" placeholder="e.g. 36" />
            <Field controller={fieldController} name="existing_emi" label="Existing EMI (₹/mo, if any)" icon={TrendingDown} type="number" placeholder="0" />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => { setForm(EMPTY); setErrors({}); setTouched({}); }}
          >
            Reset
          </button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
            {submitting ? (
              <><span className="spinner" style={{ width: 16, height: 16 }} /> Screening…</>
            ) : (
              <><CheckCircle2 size={16} /> Submit & Screen</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
