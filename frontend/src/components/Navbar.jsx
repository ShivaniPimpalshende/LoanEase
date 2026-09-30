import React from "react";
import { NavLink } from "react-router-dom";
import { FilePlus, LayoutDashboard, LogOut, ShieldCheck, UserRound } from "lucide-react";

export default function Navbar({ session, onLogout }) {
  const isOfficer = session?.role === "officer";
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <NavLink to={isOfficer ? "/officer" : "/my-dashboard"} className="navbar-brand" style={{ textDecoration: "none" }}>
          <div className="brand-icon"><ShieldCheck size={19} /></div>
          <div>
            <div className="brand-name">LoanScreen AI</div>
            <div className="brand-sub">{isOfficer ? "Officer workspace" : "Applicant workspace"}</div>
          </div>
        </NavLink>

        <div className="nav-links">
          <NavLink
            to={isOfficer ? "/officer" : "/my-dashboard"}
            end
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <LayoutDashboard size={15} />
            {isOfficer ? "Review queue" : "My dashboard"}
          </NavLink>
          {isOfficer ? <span className="nav-role-pill"><BriefcaseIcon /> Officer</span> : <NavLink to="/apply" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}><FilePlus size={15} /> New Application</NavLink>}
          <span className="nav-user"><UserRound size={14} /> {session?.email?.split("@")[0]}</span>
          <button className="nav-logout" onClick={onLogout} title="Sign out"><LogOut size={15} /></button>
        </div>
      </div>
    </nav>
  );
}

function BriefcaseIcon() {
  return <LayoutDashboard size={14} />;
}
