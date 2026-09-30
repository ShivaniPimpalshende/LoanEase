import React, { useEffect, useState } from "react";
import { CheckCircle2, FlaskConical, LoaderCircle, SlidersHorizontal, X } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../api";
import { inr, recBadge, recEmoji } from "./UIHelpers";

const MAX_TENURES = { personal: 60, auto: 84, education: 120, home: 360 };

export default function WhatIfModal({ app, onClose, onApplied }) {
  const maxTenure = MAX_TENURES[app.loan_type] || 360;
  const [amount, setAmount] = useState(app.loan_amount);
  const [tenure, setTenure] = useState(Math.min(app.tenure_months, maxTenure));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      api.whatIf(app.app_id, { loan_amount: Number(amount), tenure_months: Number(tenure) })
        .then(({ data }) => { if (!cancelled) setResult(data); })
        .catch((error) => { if (!cancelled) toast.error(error?.response?.data?.detail || "Simulation failed"); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [amount, tenure, app.app_id]);

  async function applyTerms() {
    setApplying(true);
    try {
      const { data } = await api.applyTerms(app.app_id, { loan_amount: Number(amount), tenure_months: Number(tenure) });
      toast.success("Terms applied and application recalculated");
      onApplied(data);
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Could not apply terms");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal what-if-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="card-title what-if-title"><FlaskConical size={17} /> What-if term explorer</div>
            <div className="card-sub">Preview a different loan shape without changing the application.</div>
          </div>
          <button className="modal-close" onClick={onClose} title="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="what-if-control">
            <div className="what-if-label"><span>Loan amount</span><strong>{inr(amount)}</strong></div>
            <input type="range" min={10000} max={Math.max(5000000, app.loan_amount * 2)} step={10000} value={amount} onChange={(event) => setAmount(event.target.value)} />
          </div>
          <div className="what-if-control">
            <div className="what-if-label"><span>Tenure (max {maxTenure} mo)</span><strong>{tenure} months</strong></div>
            <input type="range" min={1} max={maxTenure} step={1} value={tenure} onChange={(event) => setTenure(event.target.value)} />
          </div>

          {loading ? <div className="what-if-loading"><LoaderCircle size={17} /> Recalculating terms...</div> : result && (
            <div className="what-if-result">
              <div className="what-if-result-head"><span>Simulated recommendation</span><span className={recBadge(result.recommendation)}>{recEmoji(result.recommendation)} {result.recommendation}</span></div>
              <div className="what-if-metrics"><div><span>Monthly EMI</span><strong>{inr(result.emi_amount)}</strong></div><div><span>EMI ratio</span><strong>{((result.emi_ratio || 0) * 100).toFixed(1)}%</strong></div></div>
              <p>{result.explanation_text}</p>
              {result.gap_to_approval && <div className="what-if-gap"><SlidersHorizontal size={14} /> {result.gap_to_approval.status === "already_approved" ? "These terms meet approval conditions." : result.gap_to_approval.status === "no_path_found" ? "No approval path found in the tested scenarios." : "These terms improve the path to approval."}</div>}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={applyTerms} disabled={!result || loading || applying}><CheckCircle2 size={15} />{applying ? "Applying..." : "Apply these terms"}</button>
        </div>
      </div>
    </div>
  );
}
