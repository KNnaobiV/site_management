import React from 'react';

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

export default Badge;
