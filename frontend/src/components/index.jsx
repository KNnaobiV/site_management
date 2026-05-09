import Modal from "./Modal";
import Sidebar from "./Sidebar";
import DashboardShell from "./DashboardShell";
import ProjectCard from "./ProjectCard";
import PlotCard from "./PlotCard";
import JobItemCard from "./JobItemCard";
import WorkItemCard from "./WorkItemCard";
import NotificationItem from "./NotificationItem";
import Badge from "./Badge";
import StatusBadge from "./StatusBadge";
import Avatar from "./Avatar";
import StatCard from "./StatCard";

// ---------------------------------------------------------------------------
// RoleBadge
// ---------------------------------------------------------------------------
import { ROLE_COLORS } from "../constants/colours";
export function RoleBadge({ role, small }) {
    const key = role?.toLowerCase().replace(/\s+/g, "_");
    const colors = ROLE_COLORS[key] || ROLE_COLORS.consultant;
    return <Badge label={role} colors={colors} small={small} />;
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------
export function Spinner() {
    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem 0" }}>
            <div style={{
                width: 28, height: 28,
                border: "2px solid var(--border-default)",
                borderTopColor: "var(--brand-orange)",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
            }} />
        </div>
    );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------
export function EmptyState({ icon, title, subtitle }) {
    return (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-secondary)" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
            <p style={{ fontWeight: 500, color: "var(--text-primary)", margin: "0 0 6px" }}>{title}</p>
            <p style={{ fontSize: 14, margin: 0 }}>{subtitle}</p>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Tabs — reusable tab bar
// ---------------------------------------------------------------------------
export function Tabs({ tabs, active, onChange, style }) {
    return (
        <div style={{
            display: "flex", gap: 2,
            borderBottom: "1px solid var(--border-subtle)",
            ...style,
        }}>
            {tabs.map(t => (
                <button key={t.id} onClick={() => onChange(t.id)}
                    style={{
                        padding: "12px 24px", background: "none", border: "none",
                        borderBottom: active === t.id ? "2px solid var(--brand-orange)" : "2px solid transparent",
                        color: active === t.id ? "var(--text-primary)" : "var(--text-tertiary)",
                        fontWeight: active === t.id ? 600 : 400,
                        cursor: "pointer", fontSize: 14, marginBottom: -1,
                        transition: "all 0.2s",
                        fontFamily: 'var(--font-sans)'
                    }}>
                    {t.label}
                </button>
            ))}
        </div>
    );
}

export { 
  Modal, 
  Sidebar, 
  DashboardShell, 
  ProjectCard, 
  PlotCard, 
  JobItemCard, 
  WorkItemCard, 
  NotificationItem,
  Badge,
  StatusBadge,
  Avatar,
  StatCard
};