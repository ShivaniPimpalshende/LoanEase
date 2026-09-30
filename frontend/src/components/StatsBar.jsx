import React from "react";
import { TrendingUp, CheckCircle, XCircle, Clock, BarChart2 } from "lucide-react";

/**
 * StatsBar — top of Dashboard (F4)
 * Shows total, approve, review, reject counts and per-loan-type approval rates.
 */
export default function StatsBar({ stats, loading }) {
  if (loading) {
    return (
      <div className="stats-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="stat-card" style={{ opacity: 0.4 }}>
            <div className="stat-value">—</div>
            <div className="stat-label">Loading…</div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <>
      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Applications</div>
        </div>
        <div className="stat-card pending">
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Pending Officer Decision</div>
        </div>
        <div className="stat-card approve">
          <div className="stat-value">{stats.approve}</div>
          <div className="stat-label">
            <CheckCircle size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
            Approved
          </div>
        </div>
        <div className="stat-card review">
          <div className="stat-value">{stats.review}</div>
          <div className="stat-label">
            <Clock size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
            Under Review
          </div>
        </div>
        <div className="stat-card reject">
          <div className="stat-value">{stats.reject}</div>
          <div className="stat-label">
            <XCircle size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
            Rejected
          </div>
        </div>
        {stats.total > 0 && (
          <div className="stat-card" style={{ borderTop: "3px solid var(--accent-purple)" }}>
            <div className="stat-value" style={{ color: "var(--accent-purple)" }}>
              {((stats.approve / stats.total) * 100).toFixed(0)}%
            </div>
            <div className="stat-label">
              <TrendingUp size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
              Overall Approval Rate
            </div>
          </div>
        )}
      </div>

      {/* Approval rate by loan type */}
      {stats.by_loan_type && stats.by_loan_type.length > 0 && (
        <div
          className="card"
          style={{ marginBottom: "1.25rem", padding: "1rem 1.25rem" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: "0.75rem",
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--text-secondary)",
            }}
          >
            <BarChart2 size={13} />
            Approval Rate by Loan Type
          </div>
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            {stats.by_loan_type.map((lt) => (
              <div key={lt.loan_type}>
                <div
                  style={{
                    fontSize: "1.2rem",
                    fontWeight: 800,
                    color: lt.approval_rate >= 50
                      ? "var(--approve-text)"
                      : lt.approval_rate >= 25
                        ? "var(--review-text)"
                        : "var(--reject-text)",
                  }}
                >
                  {lt.approval_rate}%
                </div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--text-muted)",
                    textTransform: "capitalize",
                  }}
                >
                  {lt.loan_type}
                  <span style={{ marginLeft: 4, color: "var(--text-muted)" }}>
                    ({lt.approve}/{lt.total})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
