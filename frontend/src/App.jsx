import React, { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import ApplicationForm from "./pages/ApplicationForm";
import ApplicantDashboard from "./pages/ApplicantDashboard";
import Login from "./pages/Login";

function ProtectedRoute({ session, role, children }) {
  if (!session) return <Navigate to="/login" replace />;
  if (role && session.role !== role) return <Navigate to={session.role === "officer" ? "/officer" : "/my-dashboard"} replace />;
  return children;
}

export default function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem("loan_session")) || null; } catch { return null; }
  });

  function login(nextSession) {
    localStorage.setItem("loan_session", JSON.stringify(nextSession));
    setSession(nextSession);
  }

  function logout() {
    localStorage.removeItem("loan_session");
    setSession(null);
  }

  return (
    <BrowserRouter>
      <div className="app-shell">
        {session && <Navbar session={session} onLogout={logout} />}
        <Routes>
          <Route path="/login" element={session ? <Navigate to={session.role === "officer" ? "/officer" : "/my-dashboard"} replace /> : <Login onLogin={login} />} />
          <Route path="/" element={<Navigate to={session ? (session.role === "officer" ? "/officer" : "/my-dashboard") : "/login"} replace />} />
          <Route path="/officer" element={<ProtectedRoute session={session} role="officer"><Dashboard /></ProtectedRoute>} />
          <Route path="/my-dashboard" element={<ProtectedRoute session={session} role="applicant"><ApplicantDashboard /></ProtectedRoute>} />
          <Route path="/apply" element={<ProtectedRoute session={session}><ApplicationForm /></ProtectedRoute>} />
        </Routes>
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#102a43",
            color: "#f8fbff",
            border: "1px solid rgba(255,255,255,0.2)",
            fontSize: "0.875rem",
          },
          success: { iconTheme: { primary: "#4ade80", secondary: "#0a0e1a" } },
          error:   { iconTheme: { primary: "#f87171", secondary: "#0a0e1a" } },
        }}
      />
    </BrowserRouter>
  );
}
