import React, { useEffect, useState } from "react";
import { Bell, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../api";

export default function OutboxPanel({ onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      const { data } = await api.getNotifications();
      setNotifications(data);
    } catch {
      toast.error("Could not load notification outbox");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(false); }, []);

  return (
    <section className="outbox-panel card fade-in">
      <div className="outbox-header">
        <div className="section-heading"><div><span className="overline">Communication log</span><h3>Notification outbox</h3></div><Bell size={20} /></div>
        <div className="outbox-actions"><button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={13} /> Refresh</button><button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button></div>
      </div>
      {loading ? <div className="loading-center"><div className="spinner" />Loading messages</div> : notifications.length === 0 ? <div className="empty-inline">No notifications have been sent yet.</div> : (
        <div className="outbox-list">
          {notifications.map((notification) => (
            <article className="outbox-item" key={notification.notification_id}>
              <div className="outbox-item-top"><strong>#{notification.app_id} · {notification.applicant_name}</strong><span>{new Date(notification.sent_at).toLocaleString()}</span></div>
              <p>{notification.message}</p>
              <div className="outbox-item-foot"><span className="badge badge-mock">{notification.channel} mode</span><span>{notification.delivery_status}</span></div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
