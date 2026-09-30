import React, { useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../api";

export default function ResponseModal({ app, onClose, onSent }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function sendResponse(event) {
    event.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      await api.notifyApp(app.app_id, message.trim());
      toast.success("Personal response sent and saved to outbox");
      onSent();
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Could not send response");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal response-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><div className="card-title response-title"><MessageSquare size={17} /> Personal response</div><div className="card-sub">Write directly to {app.name} about application #{app.app_id}.</div></div>
          <button className="modal-close" onClick={onClose} title="Close"><X size={18} /></button>
        </div>
        <form onSubmit={sendResponse}>
          <div className="modal-body">
            <label className="response-label" htmlFor="personal-response">Message</label>
            <textarea id="personal-response" rows="7" maxLength="2000" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a clear update for the applicant..." autoFocus />
            <div className="response-count">{message.length}/2000 characters</div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary" disabled={!message.trim() || sending}><Send size={14} /> {sending ? "Sending..." : "Send response"}</button></div>
        </form>
      </div>
    </div>
  );
}
