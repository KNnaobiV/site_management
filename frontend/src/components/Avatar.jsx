import React from 'react';
import { AVATAR_PALETTES } from "../constants/colours";

export function Avatar({ name, image, size = 36 }) {
    if (image) {
        return (
            <div style={{
                width: size, height: size, borderRadius: "50%",
                backgroundImage: `url(${image})`, backgroundSize: "cover", backgroundPosition: "center",
                flexShrink: 0,
            }} />
        );
    }
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

export default Avatar;
