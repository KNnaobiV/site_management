import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { loginUser, registerUser, fetchMe } from "../api/auth";
import "../styles/login.css";

export default function LoginPage() {
    const { login } = useAuth();
    const [tab, setTab] = useState("login");
    const [loading, setLoading] = useState(false);
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

    const updateField = (key) => (e) => {
        setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

    const showMessage = (text, type = "error") => {
        setMessage(text);
        setMessageType(type);
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
                const { user, token } = await loginUser(
                    form.username,
                    form.password
                );

                login(user, token);
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
            showMessage(error.message);
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
                            label="Username"
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
                    </div>
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