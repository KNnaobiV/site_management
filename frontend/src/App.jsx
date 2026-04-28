import { useState } from "react";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Lazy page imports — swap these for real page components as you build them.
// Pattern: each page receives { token } from context via useAuth().
import Dashboard from "./pages/Dashboard";

/**
 * App
 * ---
 * Single-page router driven by `active` state.
 * Replace the simple string-switch with React Router if the project grows.
 *
 * Auth flow:
 *  ready=false → blank screen (restoring session from localStorage)
 *  ready=true, user=null → <LoginPage />
 *  ready=true, user≠null → <DashboardShell /> with page routing inside
 */
export default function App() {
  const { user, ready } = useAuth();

  // Not ready yet — session is being restored from localStorage.
  if (!ready) return (
    <div>
      <BootScreen />
    </div>
  );

  // Unauthenticated → land on login.
  if (!user) return (
    <div>
      <LoginPage />;
    </div>
  );

  // Authenticated → enter the main app shell.
  return (
    <div>
      <Dashboard />;
    </div>
  );
}

/** Minimal blank boot screen shown while we verify a stored token. */
function BootScreen() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg-canvas)",
    }}>
      <div style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        border: "2px solid var(--border-default)",
        borderTopColor: "var(--text-secondary)",
        animation: "spin 0.7s linear infinite",
      }} />
    </div>
  );
}