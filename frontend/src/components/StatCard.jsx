import React from 'react';

export function StatCard({ label, value, sub, color, onClick }) {
    return (
        <div onClick={onClick} style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "1.5rem",
            cursor: onClick ? "pointer" : "default",
            boxShadow: 'var(--shadow-sm)'
        }}>
            <p style={{
                fontSize: 12, color: "var(--text-tertiary)",
                margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.07em",
                fontWeight: 600
            }}>
                {label}
            </p>
            <p style={{ fontSize: '32px', fontWeight: 400, fontFamily: 'var(--font-serif)', margin: "0 0 4px", color: color || "var(--text-primary)" }}>
                {value}
            </p>
            {sub && <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0 }}>{sub}</p>}
        </div>
    );
}

export default StatCard;
