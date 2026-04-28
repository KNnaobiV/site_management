import { useState } from "react";
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

        return true;
    };

    const handleSubmit = async () => {
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
                await registerUser(form);
                showMessage(
                    "Account created successfully. Please sign in.",
                    "success"
                );
                setTab("login");
            }
        } catch (error) {
            if (tab === "login") {
                showMessage(
                    "Invalid username or password. Please check your details and try again."
                );
            } else {
                showMessage(
                    "We could not create your account right now. Please confirm your details and try again."
                );
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-wrap">
            <div class="auth-panel">
                <div class="brand-mark">
                    <div class="brand-icon">
                        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 16L10 4L18 16" stroke="#FEFCF8" stroke-width="1.5" stroke-linejoin="round" />
                            <path d="M5 16V11H15V16" stroke="#FEFCF8" stroke-width="1.5" stroke-linejoin="round" />
                            <path d="M8 16V13H12V16" stroke="#FEFCF8" stroke-width="1.5" stroke-linejoin="round" />
                        </svg>
                    </div>
                    <span class="brand-name">Buildstack</span>
                </div>
                <div class="panel-copy">
                    <h1>Built for those who <em>build</em></h1>
                    <p>Manage projects, sites, teams, and daily reports — all in one unified workspace designed for modern construction management.</p>
                </div>
                <div class="panel-stats">
                    <div class="stat-item">
                        <div class="stat-num">1.2k</div>
                        <div class="stat-label">Projects</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-num">94%</div>
                        <div class="stat-label">On-time delivery</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-num">48h</div>
                        <div class="stat-label">Avg. report cycle</div>
                    </div>
                </div>
            </div>

            <div class="auth-form-wrap">
                <div class="auth-form-inner fade-in" id="login-form">
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

                    <button className="btn-primary" onClick={handleSubmit}>
                        {loading
                            ? "Please wait..."
                            : tab === "login"
                                ? "Sign In"
                                : "Create Account"}
                    </button>

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
    return (
        <div className="field-group">
            <label>{label}</label>
            <input
                type={type}
                value={value}
                onChange={onChange}
                placeholder={`Enter ${label.toLowerCase()}`}
            />
        </div>
    );
}