/**
 * formatters.js — Shared string & currency formatting utilities
 */

export function recBadge(rec) {
  if (rec === "Pending") return "badge badge-pending";
  if (rec === "Approve") return "badge badge-approve";
  if (rec === "Review")  return "badge badge-review";
  if (rec === "Reject")  return "badge badge-reject";
  return "badge";
}

export function recEmoji(rec) {
  if (rec === "Pending") return "⏳";
  if (rec === "Approve") return "✅";
  if (rec === "Review")  return "⏳";
  if (rec === "Reject")  return "❌";
  return "—";
}

export function inr(val) {
  if (val == null) return "—";
  return "₹" + Number(val).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
