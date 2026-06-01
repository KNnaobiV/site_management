export let API_BASE = "https://constropal.alwaysdata..net/api";

export const buildUrl = (path) => path.startsWith("http") ? path : `${API_BASE}${path}`;

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