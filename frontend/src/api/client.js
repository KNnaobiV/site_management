export const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api";

function buildUrl(path) {
    if (path.startsWith("http://") || path.startsWith("https://")) {
        return path;
    }
    return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getMediaUrl(path) {
    if (!path) return '';
    if (path.startsWith("http://") || path.startsWith("https://")) {
        return path;
    }
    const baseHost = API_BASE.replace(/\/api\/?$/, "");
    return `${baseHost}${path.startsWith("/") ? path : `/${path}`}`;
}

let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed(newToken) {
    refreshSubscribers.forEach(cb => cb(newToken));
    refreshSubscribers = [];
}

async function refreshAccessToken() {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) return null;

    try {
        const response = await fetch(buildUrl("/auth/token/refresh/"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: refreshToken }),
        });

        if (!response.ok) {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            return null;
        }

        const data = await response.json();
        if (data.access) {
            localStorage.setItem("access_token", data.access);
            if (data.refresh) {
                localStorage.setItem("refresh_token", data.refresh);
            }
            return data.access;
        }
    } catch (err) {
        console.error("Failed to refresh access token:", err);
    }
    return null;
}

export async function apiFetch(path, { token, _isRetry = false, ...options } = {}) {
    const activeToken = token || localStorage.getItem("access_token");

    const headers = {
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        ...options.headers,
    };

    const res = await fetch(buildUrl(path), { ...options, headers });

    // Automatic token refresh on 401 Unauthorized
    if (
        res.status === 401 &&
        !_isRetry &&
        !path.includes("/auth/token/refresh/") &&
        !path.includes("/auth/login/")
    ) {
        if (!isRefreshing) {
            isRefreshing = true;
            const newToken = await refreshAccessToken();
            isRefreshing = false;

            onRefreshed(newToken);
            if (newToken) {
                return apiFetch(path, { ...options, token: newToken, _isRetry: true });
            }
        } else {
            return new Promise(resolve => {
                refreshSubscribers.push(newToken => {
                    if (newToken) {
                        resolve(apiFetch(path, { ...options, token: newToken, _isRetry: true }));
                    } else {
                        resolve(res);
                    }
                });
            });
        }
    }

    return res;
}

/** Unwrap paginated or plain array responses */
export function unwrapList(data) {
    return Array.isArray(data) ? data : data.results ?? [];
}

export { formatApiError } from "../utils/errorMessage";