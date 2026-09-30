import React, { useState } from "react";
import { Bot, BookOpen, RotateCcw, Send, Sparkles, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../api";
import { inr, recBadge, recEmoji } from "./UIHelpers";

export default function Chatbot({ appId }) {
  const welcomeMessage = { sender: "bot", text: `Hi! Ask me about application #${appId}, eligibility rules, or try a simulation like “What if I take ₹5 lakh for 48 months?”`, sources: [] };
  const [messages, setMessages] = useState([
    welcomeMessage,
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage(event) {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;
    const nextMessages = [...messages, { sender: "user", text: message }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const { data } = await api.chat(appId, {
        message,
        history: nextMessages.map((item) => ({ role: item.sender, content: item.text })),
      });
      setMessages((current) => [...current, { sender: "bot", text: data.reply, sources: data.sources || [], whatif: data.whatif_result }]);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Guidance assistant is unavailable");
      setMessages((current) => [...current, { sender: "bot", text: "I could not reach the guidance service. Please try again.", sources: [] }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card chatbot-card">
      <div className="chatbot-header">
        <div className="section-heading"><div><span className="overline">Policy assistant</span><h3>Ask about your application</h3></div><Bot size={21} /></div>
        <div className="chatbot-header-actions"><span className="chatbot-pill">Live engine</span><button className="chat-reset" onClick={() => setMessages([welcomeMessage])} title="Clear chat"><RotateCcw size={13} /></button></div>
      </div>
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div className={`chat-message ${message.sender === "user" ? "chat-message-user" : ""}`} key={`${message.sender}-${index}`}>
            <div className="chat-avatar">{message.sender === "user" ? <UserRound size={14} /> : <Bot size={14} />}</div>
            <div className="chat-bubble-wrap"><div className="chat-bubble">{message.text}</div>
              {message.sources?.length > 0 && <div className="chat-sources"><BookOpen size={11} /> {message.sources.join(" · ")}</div>}
              {message.whatif && <div className="chat-whatif"><strong>{recEmoji(message.whatif.recommendation)} {message.whatif.recommendation}</strong><span>{inr(message.whatif.emi_amount)} EMI · {((message.whatif.emi_ratio || 0) * 100).toFixed(1)}% ratio</span><span className={recBadge(message.whatif.recommendation)}>Simulation</span></div>}
            </div>
          </div>
        ))}
        {loading && <div className="chat-loading"><Sparkles size={14} /> Checking policy and application data...</div>}
      </div>
      <form className="chat-input-row" onSubmit={sendMessage}>
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask why, or try a what-if..." aria-label="Ask loan guidance assistant" />
        <button className="btn btn-primary chat-send" disabled={loading || !input.trim()} title="Send message"><Send size={15} /></button>
      </form>
    </section>
  );
}
