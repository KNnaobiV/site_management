export let API_BASE = "http://127.0.0.1:8000/api";

export async function apiFetch(path, { token, ...options } = {}) {
    const headers = {
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Token ${token}` } : {}),
        ...options.headers,
    };

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    return res;
}

/** Unwrap paginated or plain array responses */
export function unwrapList(data) {
    return Array.isArray(data) ? data : data.results ?? [];
}