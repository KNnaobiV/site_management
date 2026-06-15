import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { loginUser, registerUser, socialLogin, confirmEmail } from "../api/auth";
import "../styles/login.css";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID || "";

function loadScript(src, id) {
    return new Promise((resolve, reject) => {
        if (document.getElementById(id)) return resolve();
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.id = id;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script ${src}`));
        document.body.appendChild(script);
    });
}

export default function LoginPage() {
    const { login } = useAuth();
    const [searchParams] = useSearchParams();
    const confirmState = searchParams.get("confirm");
    const confirmKey = searchParams.get("confirm_key");

    const [tab, setTab] = useState(confirmState === "success" ? "success" : "login");
    const [loading, setLoading] = useState(false);
    const [socialLoading, setSocialLoading] = useState(false);
    const [googleReady, setGoogleReady] = useState(false);
    const [appleReady, setAppleReady] = useState(false);
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState("error");

    const [form, setForm] = useState({
        username: "",
        password: "",
        confirm_password: "",
        email: "",
        first_name: "",
        last_name: "",
    });

    const [socialInitialized, setSocialInitialized] = useState(false);

    const updateField = (key) => (e) => {
        setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

    const showMessage = (text, type = "error") => {
        setMessage(text);
        setMessageType(type);
    };

    useEffect(() => {
        if (confirmKey) {
            setLoading(true);
            confirmEmail(confirmKey)
                .then(() => {
                    setTab("success");
                    showMessage("Your email has been confirmed successfully!", "success");
                })
                .catch((err) => {
                    showMessage(err.message, "error");
                })
                .finally(() => {
                    setLoading(false);
                });
        } else if (confirmState === "success") {
            showMessage("Your email has been confirmed successfully!", "success");
        } else if (confirmState === "already_confirmed") {
            showMessage("Your email is already confirmed. Please sign in.", "success");
        } else if (confirmState === "error") {
            showMessage("The confirmation link is invalid or has expired.", "error");
        }
    }, [confirmState, confirmKey]);

    useEffect(() => {
        async function initSocialProviders() {
            if (GOOGLE_CLIENT_ID) {
                try {
                    await loadScript("https://accounts.google.com/gsi/client", "google-identity-script");
                    if (window.google?.accounts?.id) {
                        window.google.accounts.id.initialize({
                            client_id: GOOGLE_CLIENT_ID,
                            callback: handleGoogleCredentialResponse,
                            ux_mode: "popup",
                        });
                        window.google.accounts.id.renderButton(
                            document.getElementById("google-signin-button"),
                            { theme: "outline", size: "large", width: "100%" }
                        );
                        setGoogleReady(true);
                    }
                } catch (error) {
                    console.error("Google sign-in failed to load:", error);
                }
            }

            if (APPLE_CLIENT_ID) {
                try {
                    await loadScript(
                        "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js",
                        "appleid-script"
                    );
                    if (window.AppleID?.auth) {
                        window.AppleID.auth.init({
                            clientId: APPLE_CLIENT_ID,
                            scope: "name email",
                            redirectURI: `${window.location.origin}/login`,
                            usePopup: true,
                        });
                        setAppleReady(true);
                    }
                } catch (error) {
                    console.error("Apple sign-in failed to load:", error);
                }
            }

            setSocialInitialized(true);
        }

        initSocialProviders();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleGoogleCredentialResponse = async (response) => {
        if (!response?.credential) {
            showMessage("Google did not return a valid credential.");
            return;
        }

        setSocialLoading(true);
        try {
            const data = await socialLogin("google", {
                id_token: response.credential,
            });
            login(data.user, data.access, data.refresh);
        } catch (error) {
            showMessage(error.message || "Google login failed.");
        } finally {
            setSocialLoading(false);
        }
    };

    const handleAppleSignIn = async () => {
        if (!window.AppleID?.auth) {
            showMessage("Apple sign-in is unavailable right now.");
            return;
        }

        setSocialLoading(true);
        try {
            const result = await window.AppleID.auth.signIn();
            const idToken = result?.authorization?.id_token;
            if (!idToken) {
                throw new Error("Apple did not return a valid ID token.");
            }
            const data = await socialLogin("apple", {
                id_token: idToken,
            });
            login(data.user, data.access, data.refresh);
        } catch (error) {
            showMessage(error.message || "Apple login failed.");
        } finally {
            setSocialLoading(false);
        }
    };

    const handleGoogleMockSignIn = async () => {
        setSocialLoading(true);
        try {
            const data = await socialLogin("google", {
                id_token: "mock-google-token",
            });
            login(data.user, data.access, data.refresh);
        } catch (error) {
            showMessage(error.message || "Mock Google login failed.");
        } finally {
            setSocialLoading(false);
        }
    };

    const handleAppleMockSignIn = async () => {
        setSocialLoading(true);
        try {
            const data = await socialLogin("apple", {
                id_token: "mock-apple-token",
            });
            login(data.user, data.access, data.refresh);
        } catch (error) {
            showMessage(error.message || "Mock Apple login failed.");
        } finally {
            setSocialLoading(false);
        }
    };


    const validateRegister = () => {
        if (!form.first_name.trim() || !form.last_name.trim()) {
            showMessage("Please enter your first name and last name.");
            return false;
        }

        if (!form.email.trim()) {
            showMessage("Please enter your email address.");
            return false;
        }

        if (form.password.length < 6) {
            showMessage("Password should be at least 6 characters long.");
            return false;
        }

        if (form.password !== form.confirm_password) {
            showMessage("Passwords do not match.");
            setForm(prev => ({ ...prev, confirm_password: "" }));
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        setMessage("");

        if (!form.username.trim()) {
            showMessage("Please enter your username.");
            return;
        }

        if (!form.password.trim()) {
            showMessage("Please enter your password.");
            return;
        }

        if (tab === "register" && !validateRegister()) {
            return;
        }

        setLoading(true);

        try {
            if (tab === "login") {
                const { user, access, refresh } = await loginUser(
                    form.username,   // accepted as email or username by backend
                    form.password
                );

                login(user, access, refresh);
            } else {
                // Map confirm_password to password2 for backend
                const payload = {
                    ...form,
                    password2: form.confirm_password
                };
                delete payload.confirm_password;

                await registerUser(payload);
                showMessage(
                    "Account created successfully. Please sign in.",
                    "success"
                );
                setTab("login");
            }
        } catch (error) {
            if (error.message && (error.message.includes("Account is not active") || error.message.includes("not active"))) {
                showMessage(
                    <>
                        Account is not active. Please confirm your email before logging in.{" "}
                        <Link to={`/resend-confirmation?email=${encodeURIComponent(form.username)}`} style={{ textDecoration: 'underline' }}>Click here to resend confirmation link</Link>
                    </>,
                    "error"
                );
            } else {
                showMessage(error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-wrap">
            <div className="auth-panel">
                <div className="brand-mark">
                    <div className="brand-icon">
                        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 16L10 4L18 16" stroke="#FEFCF8" strokeWidth="1.5" strokeLinejoin="round" />
                            <path d="M5 16V11H15V16" stroke="#FEFCF8" strokeWidth="1.5" strokeLinejoin="round" />
                            <path d="M8 16V13H12V16" stroke="#FEFCF8" strokeWidth="1.5" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <span className="brand-name">
                        <span className="panel-copy">Iron<em style={{ color: "var(--rust-light)" }}>Work</em></span>
                    </span>
                </div>
                <div className="panel-copy">
                    <h1 style={{ color: "white" }}>Built for those who <em>build</em></h1>
                    <p>Manage projects, sites, teams, and daily reports — all in one unified workspace designed for modern construction management.</p>
                </div>
                <div className="panel-stats">
                    <div className="stat-item">
                        <div className="stat-num">1.2k</div>
                        <div className="stat-label">Projects</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-num">94%</div>
                        <div className="stat-label">On-time delivery</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-num">48h</div>
                        <div className="stat-label">Avg. report cycle</div>
                    </div>
                </div>
            </div>

            <div className="auth-form-wrap">
                <div className="auth-form-inner fade-in" id="login-form">
                    {tab === "success" ? (
                        <div style={{ textAlign: "center", padding: "2rem 0" }}>
                            <div style={{ marginBottom: "1rem", color: "var(--success, #10b981)" }}>
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                            </div>
                            <h2 style={{ color: "black", marginBottom: "1rem" }}>Email Confirmed</h2>
                            <p style={{ marginBottom: "2rem", color: "var(--text-secondary)" }}>Your email address has been successfully verified. You can now access your workspace.</p>
                            <button className="btn-primary" onClick={() => { setTab("login"); setMessage(""); }}>
                                Click here to login
                            </button>
                        </div>
                    ) : (
                        <>
                            <h2 style={{ color: "black" }}>{tab === "login" ? "Welcome back" : "Create account"}</h2>
                            <p>
                                {tab === "login"
                                    ? "Sign in to continue"
                                    : "Get started with your construction workspace"}
                            </p>

                            {message && (
                                <div
                                    className={
                                        messageType === "success" ? "success-msg" : "error-msg"
                                    }
                                >
                                    {message}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'inherit', width: '100%' }}>
                                {tab === "register" && (
                                    <div className="field-row">
                                        <Field
                                            label="First Name"
                                            value={form.first_name}
                                            onChange={updateField("first_name")}
                                        />
                                        <Field
                                            label="Last Name"
                                            value={form.last_name}
                                            onChange={updateField("last_name")}
                                        />
                                    </div>
                                )}

                                {tab === "register" && (
                                    <Field
                                        label="Email"
                                        type="email"
                                        value={form.email}
                                        onChange={updateField("email")}
                                    />
                                )}

                                <Field
                                    label="Username or Email"
                                    value={form.username}
                                    onChange={updateField("username")}
                                />

                                <Field
                                    label="Password"
                                    type="password"
                                    value={form.password}
                                    onChange={updateField("password")}
                                />

                                {tab === "register" && (
                                    <Field
                                        label="Confirm Password"
                                        type="password"
                                        value={form.confirm_password}
                                        onChange={updateField("confirm_password")}
                                    />
                                )}

                                <div style={{ textAlign: "right", marginTop: -8, marginBottom: 12 }}>
                                    <a onClick={() => window.location.href = "/forgot-password"} style={{ fontSize: 13, color: "var(--rust)", cursor: "pointer", textDecoration: "none" }}>
                                        Forgot password?
                                    </a>
                                </div>

                                <button type="submit" className="btn-primary">
                                    {loading
                                        ? "Please wait..."
                                        : tab === "login"
                                            ? "Sign In"
                                            : "Create Account"}
                                </button>

                                {(googleReady || appleReady) && (
                                    <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <div style={{ position: 'relative', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                                            <span style={{ background: 'white', padding: '0 12px', position: 'relative', zIndex: 1 }}>
                                                Or continue with
                                            </span>
                                            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: '#e5e7eb', zIndex: 0 }} />
                                        </div>
                                        <div className="social-buttons-grid">
                                            {googleReady ? (
                                                <div id="google-signin-button" style={{ width: '100%' }} />
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="btn-social google"
                                                    onClick={handleGoogleMockSignIn}
                                                    disabled={loading || socialLoading}
                                                >
                                                    <svg className="social-icon" viewBox="0 0 24 24">
                                                        <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.24 1 3.21 3.73 1.25 7.68l3.87 3C6.07 7.75 8.83 5.04 12 5.04z" />
                                                        <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.47h6.46c-.28 1.47-1.11 2.71-2.36 3.55l3.66 2.84c2.14-1.97 3.39-4.87 3.39-8.52z" />
                                                        <path fill="#FBBC05" d="M5.12 10.68c-.25-.75-.39-1.56-.39-2.39s.14-1.64.39-2.39L1.25 2.9C.45 4.5.01 6.3.01 8.29s.44 3.79 1.24 5.39l3.87-3z" />
                                                        <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.01.68-2.31 1.09-3.9 1.09-3.17 0-5.93-2.71-6.88-5.64l-3.87 3C3.21 20.27 7.24 23 12 23z" />
                                                    </svg>
                                                    Google
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                className="btn-social apple"
                                                onClick={appleReady ? handleAppleSignIn : handleAppleMockSignIn}
                                                disabled={loading || socialLoading}
                                            >
                                                <svg className="social-icon" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.58 2.95-1.39z" />
                                                </svg>
                                                Apple
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </form>

                            <div className="auth-switch">
                                {tab === "login" ? (
                                    <>
                                        Don’t have an account?{" "}
                                        <a onClick={() => setTab("register")}>Create one</a>
                                    </>
                                ) : (
                                    <>
                                        Already have an account?{" "}
                                        <a onClick={() => setTab("login")}>Sign in</a>
                                    </>
                                )}

                                <button
                                    type="button"
                                    className="btn-social apple"
                                    onClick={appleReady ? handleAppleSignIn : handleAppleMockSignIn}
                                    disabled={loading || socialLoading}
                                >
                                    <svg className="social-icon" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.58 2.95-1.39z" />
                                    </svg>
                                    Apple
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function Field({ label, type = "text", value, onChange }) {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    const currentType = isPassword ? (showPassword ? "text" : "password") : type;

    return (
        <div className="field-group">
            <label>{label}</label>
            <div style={{ position: 'relative' }}>
                <input
                    type={currentType}
                    value={value}
                    onChange={onChange}
                    placeholder={`Enter ${label.toLowerCase()}`}
                    style={isPassword ? { paddingRight: '40px' } : {}}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-tertiary)',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                )}
            </div>
        </div>
    );
}