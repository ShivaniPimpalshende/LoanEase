import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, KeyRound, LockKeyhole, Mail, Phone, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../api";

const DEMO_USERS = {
  applicant: { email: "applicant@loanscreen.test", password: "applicant123" },
  officer: { email: "officer@loanscreen.test", password: "officer123" },
};

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [role, setRole] = useState("applicant");
  const [authMethod, setAuthMethod] = useState("email");
  const [email, setEmail] = useState(DEMO_USERS.applicant.email);
  const [password, setPassword] = useState(DEMO_USERS.applicant.password);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState("");
  const [loading, setLoading] = useState(false);

  function chooseRole(nextRole) {
    setRole(nextRole);
    setEmail(DEMO_USERS[nextRole].email);
    setPassword(DEMO_USERS[nextRole].password);
    setOtpSent(false);
    setCode("");
    setDevOtp("");
  }

  function signInWithEmail(event) {
    event.preventDefault();
    const user = DEMO_USERS[role];
    if (email.trim().toLowerCase() !== user.email || password !== user.password) {
      toast.error("Invalid email or password");
      return;
    }
    onLogin({ role, email: user.email, auth_method: "email" });
    navigate(role === "officer" ? "/officer" : "/my-dashboard");
  }

  async function requestOtp(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.requestOtp({ phone, role });
      setOtpSent(true);
      setDevOtp(data.dev_otp || "");
      toast.success(data.mode === "dev" ? "Development OTP generated" : "OTP sent to your phone");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Could not send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.verifyOtp({ phone, role, code });
      onLogin(data);
      navigate(role === "officer" ? "/officer" : "/my-dashboard");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-visual">
        <div className="auth-orbit orbit-one" />
        <div className="auth-orbit orbit-two" />
        <div className="auth-visual-copy">
          <div className="eyebrow"><ShieldCheck size={14} /> Trusted loan decisions</div>
          <h1>Clarity before commitment.</h1>
          <p>Screen applications in seconds, understand every decision, and keep borrowers moving forward.</p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card fade-in">
          <div className="auth-brand-mark"><BriefcaseBusiness size={19} /></div>
          <div className="auth-kicker">LOANSCREEN AI</div>
          <h2>Welcome back</h2>
          <p className="auth-muted">Choose your workspace to continue.</p>

          <div className="role-switcher" role="tablist" aria-label="Choose workspace">
            <button className={role === "applicant" ? "role-tab active" : "role-tab"} onClick={() => chooseRole("applicant")} type="button">
              <UserRound size={16} /> Applicant
            </button>
            <button className={role === "officer" ? "role-tab active" : "role-tab"} onClick={() => chooseRole("officer")} type="button">
              <BriefcaseBusiness size={16} /> Officer
            </button>
          </div>

          <div className="auth-method-switcher" role="tablist" aria-label="Choose login method">
            <button className={authMethod === "email" ? "auth-method active" : "auth-method"} onClick={() => { setAuthMethod("email"); setOtpSent(false); }} type="button"><Mail size={14} /> Email</button>
            <button className={authMethod === "phone" ? "auth-method active" : "auth-method"} onClick={() => setAuthMethod("phone")} type="button"><Phone size={14} /> Phone OTP</button>
          </div>

          {authMethod === "email" ? <form className="auth-form" onSubmit={signInWithEmail}>
            <label htmlFor="email">Email address</label>
            <div className="input-with-icon"><Mail size={16} /><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
            <label htmlFor="password">Password</label>
            <div className="input-with-icon"><LockKeyhole size={16} /><input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
            <button className="btn btn-primary auth-submit" type="submit">Enter with email <ArrowRight size={16} /></button>
          </form> : <form className="auth-form" onSubmit={otpSent ? verifyOtp : requestOtp}>
            <label htmlFor="phone">Phone number</label>
            <div className="input-with-icon">
              <Phone size={16} />
              <input id="phone" type="tel" placeholder="+91 9876543210" value={phone} onChange={(event) => setPhone(event.target.value)} required disabled={otpSent} />
            </div>
            {otpSent && <><label htmlFor="otp">One-time password</label><div className="input-with-icon"><KeyRound size={16} /><input id="otp" inputMode="numeric" autoComplete="one-time-code" placeholder="Enter 6-digit OTP" value={code} onChange={(event) => setCode(event.target.value)} required /></div></>}
            <button className="btn btn-primary auth-submit" type="submit">
              {loading ? <><RefreshCw size={16} className="spin-icon" /> Working...</> : otpSent ? <>Verify and enter workspace <ArrowRight size={16} /></> : <>Send OTP <ArrowRight size={16} /></>}
            </button>
          </form>}

          {authMethod === "email" ? <div className="demo-credentials"><span>Demo email access</span><strong>{DEMO_USERS[role].email}</strong><strong>{DEMO_USERS[role].password}</strong></div> : devOtp && <div className="demo-credentials"><span>Development mode OTP</span><strong>{devOtp}</strong></div>}
          {otpSent && <button className="auth-change-number" onClick={() => { setOtpSent(false); setCode(""); setDevOtp(""); }} type="button">Use a different number</button>}
        </div>
      </section>
    </main>
  );
}
