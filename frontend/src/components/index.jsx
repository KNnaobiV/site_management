import { STATUS_COLORS, ROLE_COLORS, AVATAR_PALETTES } from "../constants/colours";

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------
export function Badge({ label, colors, small = false }) {
    return (
        <span style={{
            background: colors.bg,
            color: colors.text,
            borderRadius: 6,
            padding: small ? "2px 8px" : "3px 10px",
            fontSize: small ? 11 : 12,
            fontWeight: 500,
            letterSpacing: "0.01em",
            whiteSpace: "nowrap",
        }}>
            {label}
        </span>
    );
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------
export function StatusBadge({ status }) {
    const c = STATUS_COLORS[status] || STATUS_COLORS["Planned"];
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: c.bg, color: c.text,
            borderRadius: 6, padding: "3px 10px",
            fontSize: 12, fontWeight: 500,
        }}>
            <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: c.dot, flexShrink: 0,
            }} />
            {status}
        </span>
    );
}

// ---------------------------------------------------------------------------
// RoleBadge
// ---------------------------------------------------------------------------
export function RoleBadge({ role, small }) {
    const key = role?.toLowerCase().replace(/\s+/g, "_");
    const colors = ROLE_COLORS[key] || ROLE_COLORS.consultant;
    return <Badge label={role} colors={colors} small={small} />;
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------
export function Avatar({ name, size = 36 }) {
    const initials = name
        ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
        : "?";
    const palette = AVATAR_PALETTES[initials.charCodeAt(0) % AVATAR_PALETTES.length];
    return (
        <div style={{
            width: size, height: size, borderRadius: "50%",
            background: palette.bg, color: palette.text,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: size * 0.36, fontWeight: 600, flexShrink: 0,
        }}>
            {initials}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------
export function Spinner() {
    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem 0" }}>
            <div style={{
                width: 28, height: 28,
                border: "2px solid #D3D1C7",
                borderTopColor: "#185FA5",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
    );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------
export function EmptyState({ icon, title, subtitle }) {
    return (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--color-text-secondary)" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
            <p style={{ fontWeight: 500, color: "var(--color-text-primary)", margin: "0 0 6px" }}>{title}</p>
            <p style={{ fontSize: 14, margin: 0 }}>{subtitle}</p>
        </div>
    );
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------
export function StatCard({ label, value, sub, color }) {
    return (
        <div style={{
            background: "var(--color-background-secondary)",
            borderRadius: "var(--border-radius-md)",
            padding: "1rem 1.25rem",
        }}>
            <p style={{
                fontSize: 12, color: "var(--color-text-secondary)",
                margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.07em",
            }}>
                {label}
            </p>
            <p style={{ fontSize: 26, fontWeight: 500, margin: "0 0 4px", color: color || "var(--color-text-primary)" }}>
                {value}
            </p>
            {sub && <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>{sub}</p>}
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
            borderBottom: "0.5px solid var(--color-border-tertiary)",
            ...style,
        }}>
            {tabs.map(t => (
                <button key={t.id} onClick={() => onChange(t.id)}
                    style={{
                        padding: "8px 20px", background: "none", border: "none",
                        borderBottom: active === t.id ? "2px solid #185FA5" : "2px solid transparent",
                        color: active === t.id ? "#185FA5" : "var(--color-text-secondary)",
                        fontWeight: active === t.id ? 500 : 400,
                        cursor: "pointer", fontSize: 14, marginBottom: -1,
                    }}>
                    {t.label}
                </button>
            ))}
        </div>
    );
}