export const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api";

function buildUrl(path) {
    if (path.startsWith("http://") || path.startsWith("https://")) {
        return path;
    }
    return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

// export const buildUrl = (path) => path.startsWith("http") ? path : `${API_BASE}${path}`;

export async function apiFetch(path, { token, ...options } = {}) {
    const headers = {
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Token ${token}` } : {}),
        ...options.headers,
    };

    const res = await fetch(buildUrl(path), { ...options, headers });
    return res;
}

/** Unwrap paginated or plain array responses */
export function unwrapList(data) {
    return Array.isArray(data) ? data : data.results ?? [];
}