import { apiFetch } from "./client";

export async function loginUser(login, password) {
    const res = await apiFetch("/auth/login/", {
        method: "POST",
        body: JSON.stringify({ login, password }),
    });
    let data;
    try {
        data = await res.json();
    } catch (e) {
        throw new Error(`Server returned an unexpected error (${res.status}).`);
    }

    if (!res.ok) {
        const errorMsg = data.non_field_errors?.[0] || data.detail || Object.values(data).flat().join(" ") || "Invalid credentials";
        throw new Error(errorMsg);
    }
    return data; // { user, access, refresh, message }
}

export async function registerUser(fields) {
    const res = await apiFetch("/auth/register/", {
        method: "POST",
        body: JSON.stringify(fields),
    });
    const data = await res.json();
    if (!res.ok) {
        const errorMsg = Object.values(data).flat().join(" ") || "We could not create your account right now.";
        throw new Error(errorMsg);
    }
    return data;
}

export async function confirmEmail(key) {
    const res = await apiFetch("/auth/confirm-email/", {
        method: "POST",
        body: JSON.stringify({ key }),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.detail || "Invalid or expired confirmation link.");
    }
    return data;
}

export async function resendConfirmation(email, password) {
    const res = await apiFetch("/auth/resend-confirmation/", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.detail || "Failed to resend confirmation.");
    }
    return data;
}

export async function socialLogin(provider, payload) {
    const res = await apiFetch(`/auth/social/${provider}/`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
        const errorMsg = data.detail || Object.values(data).flat().join(" ") || "Social login failed.";
        throw new Error(errorMsg);
    }
    return data;
}

export async function fetchMe(token) {
    const res = await apiFetch("/auth/user/", { token });
    if (!res.ok) throw new Error("Session expired");
    return res.json();
}

export async function requestPasswordReset(email) {
    const res = await apiFetch("/auth/password-reset/", {
        method: "POST",
        body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong");
    return data;
}

export async function updateProfile(token, profileData) {
    const res = await apiFetch("/auth/user/", {
        method: "PATCH",
        token,
        body: JSON.stringify(profileData),
    });
    const data = await res.json();
    if (!res.ok) {
        const errorMsg = Object.values(data).flat().join(" ") || "Failed to update profile";
        throw new Error(errorMsg);
    }
    return data;
}

export async function changePassword(token, passwords) {
    const res = await apiFetch("/auth/change-password/", {
        method: "POST",
        token,
        body: JSON.stringify(passwords),
    });
    const data = await res.json();
    if (!res.ok) {
        const errorMsg = data.detail || Object.values(data).flat().join(" ") || "Failed to change password";
        throw new Error(errorMsg);
    }
    return data;
}

export async function confirmPasswordReset(uidb64, token, new_password) {
    const res = await apiFetch("/auth/password-reset/confirm/", {
        method: "POST",
        body: JSON.stringify({ uidb64, token, new_password }),
    });
    const data = await res.json();
    if (!res.ok) {
        const errorMsg = data.detail || Object.values(data).flat().join(" ") || "Failed to reset password";
        throw new Error(errorMsg);
    }
    return data;
}