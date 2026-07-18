import React from 'react';
import { STATUS_COLORS } from "../constants/colours";

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

export default StatusBadge;
