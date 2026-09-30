import React from "react";
export { recBadge, recEmoji, inr } from "../utils/formatters";

/**
 * Render an EMI ratio as a coloured progress bar + numeric text.
 */
export function RatioBar({ ratio }) {
  if (ratio == null) return <span className="muted">—</span>;
  const pct  = Math.min(ratio * 100, 100);
  const cls  = pct < 40 ? "low" : pct < 60 ? "mid" : "high";
  return (
    <div className="ratio-bar-wrap">
      <div className="ratio-bar">
        <div className="ratio-fill" style={{ width: `${pct}%` }} data-level={cls} />
      </div>
      <span className="ratio-text">{(ratio * 100).toFixed(1)}%</span>
    </div>
  );
}

/**
 * Eligibility badge: PASS / FAIL with tooltip showing per-rule details.
 */
export function EligibilityCell({ status, reasons }) {
  const badgeClass = status === "PASS" ? "badge badge-pass" : "badge badge-fail";
  if (!reasons || !reasons.length) {
    return <span className={badgeClass}>{status || "—"}</span>;
  }

  return (
    <div className="tooltip-wrap">
      <span className={badgeClass} style={{ cursor: "help" }}>
        {status === "PASS" ? "✔ PASS" : "✖ FAIL"}
      </span>
      <div className="tooltip-content">
        <div className="rules-list">
          {reasons.map((r, i) => (
            <div key={i} className="rule-row">
              <div className={`rule-dot ${r.status === "PASS" ? "pass" : "fail"}`} />
              <div>
                <strong style={{ textTransform: "capitalize" }}>{r.rule.replace("_", " ")}</strong>
                {r.detail && (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.74rem", marginTop: "1px" }}>
                    {r.detail}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
