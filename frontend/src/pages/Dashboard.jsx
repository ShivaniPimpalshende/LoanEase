import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, Filter, Bell, TrendingDown, ArrowUpDown, SlidersHorizontal, MessageSquare } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../api";
import StatsBar from "../components/StatsBar";
import GapModal from "../components/GapModal";
import WhatIfModal from "../components/WhatIfModal";
import OutboxPanel from "../components/OutboxPanel";
import ResponseModal from "../components/ResponseModal";
import { RatioBar, EligibilityCell } from "../components/UIHelpers";
import { inr, recBadge, recEmoji } from "../utils/formatters";

const LOAN_TYPES = ["personal", "home", "auto", "education"];
const STATUSES   = ["Pending", "Approve", "Review", "Reject"];
const DECISION_OPTIONS = ["Approve", "Review", "Reject"];

export default function Dashboard() {
  const [apps, setApps]           = useState([]);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType]     = useState("");
  const [sortBy, setSortBy]       = useState("priority_rank");
  const [sortOrder, setSortOrder] = useState("asc");
  const [gapApp, setGapApp]       = useState(null);    // app shown in GapModal
  const [whatIfApp, setWhatIfApp] = useState(null);
  const [showOutbox, setShowOutbox] = useState(false);
  const [responseApp, setResponseApp] = useState(null);
  const [newAppId] = useState(() => {
    const id = sessionStorage.getItem("new_app_id");
    if (id) {
      sessionStorage.removeItem("new_app_id");
      return Number(id);
    }
    return null;
  });
  const [notifying, setNotifying] = useState({});      // { app_id: true }
  const [overriding, setOverriding] = useState({});

  const fetchApps = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status    = filterStatus;
      if (filterType)   params.loan_type = filterType;
      params.sort_by = sortBy;
      params.order   = sortOrder;
      const { data } = await api.listApps(params);
      setApps(data);
    } catch {
      toast.error("Failed to load applications");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterType, sortBy, sortOrder]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.getStats();
      setStats(data);
    } catch {
      // non-critical
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApps();
    fetchStats();
  }, [fetchApps, fetchStats]);

  // ── Sort toggle ────────────────────────────────────────────────────────
  function toggleSort(field) {
    if (sortBy === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  }

  // ── Manual override ────────────────────────────────────────────────────
  async function handleOverride(appId, newRec) {
    setOverriding((o) => ({ ...o, [appId]: true }));
    try {
      await api.overrideApp(appId, newRec);
      toast.success(`Decision updated to ${newRec}`);
      fetchApps();
      fetchStats();
    } catch {
      toast.error("Override failed");
    } finally {
      setOverriding((o) => ({ ...o, [appId]: false }));
    }
  }

  // ── WhatsApp notify ────────────────────────────────────────────────────
  async function handleNotify(appId) {
    setNotifying((n) => ({ ...n, [appId]: true }));
    try {
      const { data } = await api.notifyApp(appId);
      toast.success(
        data.sent_via === "twilio"
          ? "WhatsApp message sent ✅"
          : "Notification logged (mock mode)"
      );
      fetchApps();
    } catch {
      toast.error("Notification failed");
    } finally {
      setNotifying((n) => ({ ...n, [appId]: false }));
    }
  }

  return (
    <div className="main-content">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Officer review queue</h1>
          <p className="page-sub">
            {apps.length} application{apps.length !== 1 ? "s" : ""} shown
            {(filterStatus || filterType) && " · filtered"}
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowOutbox((visible) => !visible)}><Bell size={13} /> Outbox</button>
          <button className="btn btn-secondary btn-sm" onClick={() => { fetchApps(); fetchStats(); }}><RefreshCw size={13} /> Refresh</button>
        </div>
      </div>

      {showOutbox && <OutboxPanel onClose={() => setShowOutbox(false)} />}

      {/* Stats Bar */}
      <StatsBar stats={stats} loading={statsLoading} />

      {/* Filter Bar */}
      <div className="filter-bar">
        <Filter size={14} style={{ color: "var(--text-muted)" }} />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          title="Filter by decision"
        >
          <option value="">All Decisions</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          title="Filter by loan type"
        >
          <option value="">All Loan Types</option>
          {LOAN_TYPES.map((t) => (
            <option key={t} value={t} style={{ textTransform: "capitalize" }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
        {(filterStatus || filterType) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setFilterStatus(""); setFilterType(""); }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-center">
          <div className="spinner" />
          Loading applications…
        </div>
      ) : apps.length === 0 ? (
        <div className="loading-center" style={{ color: "var(--text-muted)" }}>
          No applications match your filters.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th onClick={() => toggleSort("app_id")} className={sortBy === "app_id" ? "sorted" : ""}>
                    # <SortIcon field="app_id" sortBy={sortBy} sortOrder={sortOrder} />
                  </th>
                  <th onClick={() => toggleSort("name")} className={sortBy === "name" ? "sorted" : ""}>
                    Applicant <SortIcon field="name" sortBy={sortBy} sortOrder={sortOrder} />
                  </th>
                  <th onClick={() => toggleSort("loan_type")} className={sortBy === "loan_type" ? "sorted" : ""}>
                    Loan <SortIcon field="loan_type" sortBy={sortBy} sortOrder={sortOrder} />
                  </th>
                  <th onClick={() => toggleSort("loan_amount")} className={sortBy === "loan_amount" ? "sorted" : ""}>
                    Amount <SortIcon field="loan_amount" sortBy={sortBy} sortOrder={sortOrder} />
                  </th>
                  <th onClick={() => toggleSort("monthly_income")} className={sortBy === "monthly_income" ? "sorted" : ""}>
                    Monthly Income <SortIcon field="monthly_income" sortBy={sortBy} sortOrder={sortOrder} />
                  </th>
                  <th onClick={() => toggleSort("credit_score")} className={sortBy === "credit_score" ? "sorted" : ""}>
                    Score <SortIcon field="credit_score" sortBy={sortBy} sortOrder={sortOrder} />
                  </th>
                  <th>Eligibility</th>
                  <th onClick={() => toggleSort("emi_ratio")} className={sortBy === "emi_ratio" ? "sorted" : ""}>
                    EMI Ratio <SortIcon field="emi_ratio" sortBy={sortBy} sortOrder={sortOrder} />
                  </th>
                  <th onClick={() => toggleSort("recommendation")} className={sortBy === "recommendation" ? "sorted" : ""}>
                    Decision <SortIcon field="recommendation" sortBy={sortBy} sortOrder={sortOrder} />
                  </th>
                  <th style={{ minWidth: 220 }}>Explanation</th>
                  <th>Gap</th>
                  <th>Override</th>
                  <th>Notify</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app) => (
                  <tr
                    key={app.app_id}
                    className={app.app_id === newAppId ? "row-highlight" : ""}
                  >
                    {/* ID */}
                    <td className="muted">#{app.app_id}</td>

                    {/* Applicant */}
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "0.86rem" }}>{app.name}</div>
                      <div className="muted">{app.age}y · {app.employment_type.replace("_", " ")}</div>
                    </td>

                    {/* Loan */}
                    <td>
                      <div style={{ textTransform: "capitalize", fontWeight: 500 }}>{app.loan_type}</div>
                      <div className="muted">{app.tenure_months}mo</div>
                    </td>

                    {/* Amount */}
                    <td style={{ fontWeight: 600 }}>
                      {inr(app.loan_amount)}
                      {app.existing_emi > 0 && (
                        <div className="muted">+{inr(app.existing_emi)} existing</div>
                      )}
                    </td>

                    {/* Monthly Income */}
                    <td style={{ fontWeight: 600 }}>
                      {inr(app.monthly_income)}
                      <div className="muted">monthly gross</div>
                    </td>

                    {/* Credit Score */}
                    <td>
                      <span
                        style={{
                          fontWeight: 700,
                          color: app.credit_score > 700
                            ? "var(--approve-text)"
                            : app.credit_score > 650
                              ? "var(--review-text)"
                              : "var(--reject-text)",
                        }}
                      >
                        {app.credit_score}
                      </span>
                    </td>

                    {/* Eligibility with tooltip */}
                    <td>
                      <EligibilityCell
                        status={app.eligibility_status}
                        reasons={app.eligibility_reasons}
                      />
                    </td>

                    {/* EMI Ratio bar */}
                    <td>
                      <RatioBar ratio={app.emi_ratio} />
                      <div className="muted">{inr(app.emi_amount)}/mo</div>
                    </td>

                    {/* Decision badge */}
                    <td>
                      <span className={recBadge(app.recommendation)}>
                        {recEmoji(app.recommendation)} {app.recommendation}
                      </span>
                      {app.last_notified_status && (
                        <div className="muted" style={{ fontSize: "0.7rem", marginTop: 3 }}>
                          Notified: {app.last_notified_status}
                        </div>
                      )}
                    </td>

                    {/* Explanation (truncated, tooltip) */}
                    <td style={{ maxWidth: 240 }}>
                      <div className="tooltip-wrap">
                        <span
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--text-secondary)",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            cursor: "help",
                          }}
                        >
                          {app.explanation_text || "—"}
                        </span>
                        <div className="tooltip-content" style={{ minWidth: 300, maxWidth: 380 }}>
                          {app.explanation_text}
                        </div>
                      </div>
                    </td>

                    {/* Gap-to-Approval button */}
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setWhatIfApp(app)}
                        title="Simulate different loan terms"
                      >
                        <SlidersHorizontal size={12} />
                        What-if
                      </button>
                      {app.recommendation !== "Approve" ? (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setGapApp(app)}
                          title="View gap-to-approval analysis"
                        >
                          <TrendingDown size={12} />
                          Gap
                        </button>
                      ) : (
                        <span className="muted" style={{ fontSize: "0.75rem" }}>—</span>
                      )}
                    </td>

                    {/* Manual Override */}
                    <td>
                      <select
                        className="override-select"
                        value={app.recommendation || ""}
                        disabled={overriding[app.app_id]}
                        onChange={(e) => handleOverride(app.app_id, e.target.value)}
                      >
                        {[...new Set([app.recommendation, ...DECISION_OPTIONS])].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>

                    {/* Notify */}
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={notifying[app.app_id]}
                        onClick={() => handleNotify(app.app_id)}
                        title="Send status notification"
                      >
                        {notifying[app.app_id] ? (
                          <span className="spinner" style={{ width: 12, height: 12 }} />
                        ) : (
                          <Bell size={12} />
                        )}
                        {app.last_notified_status ? "Re-notify" : "Notify"}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm response-button"
                        onClick={() => setResponseApp(app)}
                        title="Send a personal response"
                      >
                        <MessageSquare size={12} />
                        Respond
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Gap-to-Approval Modal */}
      {gapApp && <GapModal app={gapApp} onClose={() => setGapApp(null)} />}
      {whatIfApp && (
        <WhatIfModal
          app={whatIfApp}
          onClose={() => setWhatIfApp(null)}
          onApplied={() => { fetchApps(); fetchStats(); }}
        />
      )}
      {responseApp && <ResponseModal app={responseApp} onClose={() => setResponseApp(null)} onSent={() => fetchApps()} />}
    </div>
  );
}

function SortIcon({ field, sortBy, sortOrder }) {
  if (sortBy !== field) return <ArrowUpDown size={11} style={{ opacity: 0.4 }} />;
  return <span style={{ fontSize: 10 }}>{sortOrder === "asc" ? "▲" : "▼"}</span>;
}

