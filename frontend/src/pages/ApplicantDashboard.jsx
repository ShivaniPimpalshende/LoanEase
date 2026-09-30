import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, FileText, RefreshCw, ShieldCheck, TrendingDown, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../api";
import { inr, RatioBar, recEmoji } from "../components/UIHelpers";
import Chatbot from "../components/Chatbot";

const STATUS_STEPS = ["Submitted", "Eligibility", "Screened", "Decision"];

export default function ApplicantDashboard() {
  const [application, setApplication] = useState(null);
  const [history, setHistory] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchApplication = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const appId = localStorage.getItem("demo_app_id") || "1";
      const [{ data }, historyResponse, notificationsResponse] = await Promise.all([
        api.getApp(appId),
        api.getHistory(appId),
        api.getNotifications(),
      ]);
      setApplication(data);
      setHistory(historyResponse.data);
      setNotifications(notificationsResponse.data.filter((item) => item.app_id === Number(appId)));
    } catch {
      toast.error("We could not load your application");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApplication(false); }, [fetchApplication]);

  if (loading) {
    return <div className="loading-center page-loading"><div className="spinner" />Loading your application</div>;
  }

  if (!application) return null;

  const decision = application.recommendation || "Review";
  const stepIndex = decision === "Approve" || decision === "Review" || decision === "Reject" ? 3 : 2;
  const decisionClass = decision.toLowerCase();

  return (
    <main className="main-content applicant-content fade-in">
      <div className="page-header applicant-header">
        <div>
          <div className="eyebrow"><ShieldCheck size={14} /> Private applicant view</div>
          <h1 className="page-title">Good morning, {application.name.split(" ")[0]}.</h1>
          <p className="page-sub">Here is the latest on application #{application.app_id}.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchApplication}><RefreshCw size={14} /> Refresh</button>
      </div>

      <section className={`applicant-hero applicant-hero-${decisionClass}`}>
        <div className="hero-decision-icon">{recEmoji(decision)}</div>
        <div className="hero-decision-copy">
          <span className="overline">Current recommendation</span>
          <h2>{decision}</h2>
          <p>{decision === "Pending" ? "An officer will review your application before a final decision." : decision === "Approve" ? "Your application is looking strong." : decision === "Review" ? "An officer may need a closer look before confirming." : "There are a few things to improve before approval."}</p>
        </div>
        <div className="hero-loan-total"><span>{application.loan_type} loan</span><strong>{inr(application.loan_amount)}</strong><small>{application.tenure_months} month term</small></div>
      </section>

      <section className="status-track" aria-label="Application progress">
        {STATUS_STEPS.map((step, index) => (
          <div className={`status-step ${index <= stepIndex ? "complete" : ""}`} key={step}>
            <div className="status-dot">{index < stepIndex ? <CheckCircle2 size={14} /> : index === stepIndex ? <span /> : null}</div>
            <span>{step}</span>
          </div>
        ))}
      </section>

      <div className="applicant-grid">
        <section className="card applicant-detail-card">
          <div className="section-heading"><div><span className="overline">The numbers</span><h3>Your application at a glance</h3></div><FileText size={21} /></div>
          <div className="metric-grid">
            <div className="metric-tile"><span>Monthly EMI</span><strong>{inr(application.emi_amount)}</strong><small>estimated payment</small></div>
            <div className="metric-tile"><span>EMI burden</span><strong>{((application.emi_ratio || 0) * 100).toFixed(1)}%</strong><RatioBar ratio={application.emi_ratio} /></div>
            <div className="metric-tile"><span>Monthly income</span><strong>{inr(application.monthly_income)}</strong><small>reported gross income</small></div>
            <div className="metric-tile"><span>Credit score</span><strong>{application.credit_score}</strong><small>reported score</small></div>
            <div className="metric-tile"><span>Eligibility</span><strong className={application.eligibility_status === "PASS" ? "text-success" : "text-danger"}>{application.eligibility_status}</strong><small>rule screening result</small></div>
          </div>
        </section>

        <section className="card explanation-card">
          <div className="section-heading"><div><span className="overline">In plain English</span><h3>How we reached this</h3></div><ShieldCheck size={21} /></div>
          <p>{application.explanation_text}</p>
          {application.eligibility_reasons?.length > 0 && (
            <div className="reason-list">
              {application.eligibility_reasons.map((reason) => (
                <div className="reason-item" key={reason.rule}>{reason.status === "PASS" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}<span>{reason.rule.replace("_", " ")}</span></div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="applicant-grid applicant-secondary-grid">
        <section className="card timeline-card">
          <div className="section-heading"><div><span className="overline">Decision history</span><h3>Application timeline</h3></div><Clock3Icon /></div>
          <div className="history-list">
            {history.length === 0 ? <div className="empty-inline">Your timeline will appear after submission.</div> : history.map((event) => (
              <div className="history-item" key={event.history_id}><div className="history-dot" /><div><strong>{event.new_status}</strong><span>{event.old_status ? `${event.old_status} → ${event.new_status}` : event.new_status} · {event.changed_by}</span></div><time>{new Date(event.created_at).toLocaleDateString()}</time></div>
            ))}
          </div>
        </section>
        <section className="card timeline-card">
          <div className="section-heading"><div><span className="overline">Message inbox</span><h3>Updates from LoanScreen</h3></div><BellIcon /></div>
          <div className="history-list">
            {notifications.length === 0 ? <div className="empty-inline">No messages yet. Updates will appear here.</div> : notifications.map((notification) => <div className="inbox-item" key={notification.notification_id}><span>{notification.message}</span><time>{new Date(notification.sent_at).toLocaleDateString()}</time></div>)}
          </div>
        </section>
      </div>

      <Chatbot appId={application.app_id} />

      <section className="next-step-banner">
        <div className="next-step-icon"><TrendingDown size={20} /></div>
        <div><span className="overline">Your next move</span><h3>{decision === "Pending" ? "Your application is in the review queue." : decision === "Approve" ? "Keep your documents ready." : "Want to improve your approval odds?"}</h3><p>{decision === "Pending" ? "You will see the final decision here once an officer reviews it." : decision === "Approve" ? "An officer will contact you with the next steps." : "Try a different loan amount or explore your gap-to-approval options."}</p></div>
        <Link to="/apply" className="btn btn-dark">New application <ArrowRight size={15} /></Link>
      </section>
    </main>
  );
}

function Clock3Icon() { return <span className="section-symbol">◷</span>; }
function BellIcon() { return <span className="section-symbol">♢</span>; }
