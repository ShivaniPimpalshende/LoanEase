import React from "react";
import { X, TrendingDown, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { inr } from "./UIHelpers";

/**
 * GapModal — F5.1
 * Shows the gap-to-approval analysis for a Reject or Review application.
 */
export default function GapModal({ app, onClose }) {
  if (!app) return null;

  const gap = app.gap_to_approval;
  const isAlreadyApproved = gap?.status === "already_approved";
  const hasNoPath = gap?.status === "no_path_found";
  const bestScenario = hasNoPath ? gap?.best_scenario : gap;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="card-title" style={{ fontSize: "1.05rem" }}>
              🎯 Gap-to-Approval Analysis
            </div>
            <div className="card-sub" style={{ marginTop: 4 }}>
              {app.name} · {app.loan_type} loan · {inr(app.loan_amount)}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Current state */}
          <div style={{ marginBottom: "1rem" }}>
            <div className="form-section-title">Current Profile</div>
            <div className="gap-card">
              <div className="gap-metric">
                <span>EMI Ratio</span>
                <span style={{ color: app.emi_ratio > 0.6 ? "var(--reject-text)" : "var(--review-text)" }}>
                  {((app.emi_ratio || 0) * 100).toFixed(1)}%
                  {" "}(target: &lt;40%)
                </span>
              </div>
              <div className="gap-metric">
                <span>Credit Score</span>
                <span style={{ color: app.credit_score > 700 ? "var(--approve-text)" : "var(--reject-text)" }}>
                  {app.credit_score} {app.credit_score > 700 ? "✔" : "(need >700)"}
                </span>
              </div>
              <div className="gap-metric">
                <span>Eligibility</span>
                <span style={{ color: app.eligibility_status === "PASS" ? "var(--approve-text)" : "var(--reject-text)" }}>
                  {app.eligibility_status}
                </span>
              </div>
            </div>
          </div>

          {isAlreadyApproved && (
            <div className="gap-flip-success">
              <CheckCircle2 size={15} />
              This application is already Approved — no changes needed.
            </div>
          )}

          {!isAlreadyApproved && bestScenario && (
            <div>
              <div className="form-section-title" style={{ marginTop: 0 }}>
                {hasNoPath ? "Best Achievable Scenario (doesn't flip to Approve)" : "Smallest Change to Flip → Approve"}
              </div>
              <div className="gap-card">
                {bestScenario.amount_reduction_pct > 0 && (
                  <div className="gap-metric">
                    <span>
                      <TrendingDown size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
                      Loan Amount Reduction
                    </span>
                    <span>{bestScenario.amount_reduction_pct}%
                      {" "}→ {inr(bestScenario.new_loan_amount)}</span>
                  </div>
                )}
                {bestScenario.extra_months > 0 && (
                  <div className="gap-metric">
                    <span>
                      <Clock size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
                      Tenure Extension
                    </span>
                    <span>+{bestScenario.extra_months} months
                      {" "}→ {bestScenario.new_tenure_months} months total</span>
                  </div>
                )}
                <div className="gap-metric">
                  <span>New Monthly EMI</span>
                  <span>{inr(bestScenario.new_emi)}/mo</span>
                </div>
                <div className="gap-metric">
                  <span>New EMI Ratio</span>
                  <span style={{
                    color: bestScenario.new_emi_ratio < 0.40
                      ? "var(--approve-text)"
                      : bestScenario.new_emi_ratio < 0.60
                        ? "var(--review-text)"
                        : "var(--reject-text)"
                  }}>
                    {(bestScenario.new_emi_ratio * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              {bestScenario.flips_to_approve ? (
                <div className="gap-flip-success">
                  <CheckCircle2 size={15} />
                  With these changes, this application would flip to{" "}
                  <strong style={{ marginLeft: 4 }}>Approve ✅</strong>
                </div>
              ) : (
                <div className="gap-no-path">
                  <AlertTriangle size={13} style={{ marginRight: 6, verticalAlign: "middle" }} />
                  {app.eligibility_status === "FAIL"
                    ? "This application fails eligibility rules — adjusting loan terms won't change the outcome."
                    : app.credit_score <= 700
                      ? "Credit score ≤700 is the blocking factor — loan/tenure changes alone won't flip to Approve."
                      : "No combination of ±30% amount and ±36 months tenure flips this to Approve."}
                </div>
              )}
            </div>
          )}

          {!isAlreadyApproved && !bestScenario && (
            <div className="gap-no-path">
              Gap-to-approval data not available for this application.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
