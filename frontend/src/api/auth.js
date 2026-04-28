import { apiFetch } from "./client";

export async function loginUser(username, password) {
    const res = await apiFetch("/auth/login/", {
        method: "POST",
        body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.non_field_errors?.[0] || data.detail || "Invalid credentials");
    return data; // { user, token, message }
}

export async function registerUser(fields) {
    const res = await apiFetch("/auth/register/", {
        method: "POST",
        body: JSON.stringify(fields),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(Object.values(data).flat().join(" "));
    return data;
}

export async function fetchMe(token) {
    const res = await apiFetch("/auth/user/", { token });
    if (!res.ok) throw new Error("Session expired");
    return res.json();
}