import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { resendConfirmation } from "../api/auth";
import "../styles/login.css";

export default function ResendConfirmationPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState("error");

    const [form, setForm] = useState({
        email: "",
        password: "",
    });

    useEffect(() => {
        // Grab email from navigation state or URL params if present
        const stateEmail = location.state?.email;
        const queryParams = new URLSearchParams(location.search);
        const urlEmail = queryParams.get("email");
        const isExpired = queryParams.get("expired");

        if (stateEmail || urlEmail) {
            setForm((prev) => ({ ...prev, email: stateEmail || urlEmail }));
        }

        if (isExpired === "true") {
            showMessage("Your confirmation link has expired. Please verify your password to request a new one.");
        }
    }, [location]);

    const showMessage = (text, type = "error") => {
        setMessage(text);
        setMessageType(type);
    };

    const updateField = (key) => (e) => {
        setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");

        if (!form.email.trim() || !form.password.trim()) {
            showMessage("Please enter your email and password.");
            return;
        }

        setLoading(true);
        try {
            await resendConfirmation(form.email, form.password);
            showMessage("A new confirmation link has been sent to your email.", "success");
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
                    <h1 style={{ color: "white" }}>Secure Your Account</h1>
                    <p>Verify your identity to receive a new confirmation link and continue to your workspace.</p>
                </div>
            </div>

            <div className="auth-form-wrap">
                <div className="auth-form-inner fade-in">
                    <h2 style={{ color: "black" }}>Resend Confirmation Link</h2>
                    <p>Enter your password to verify your identity.</p>

                    {message && (
                        <div className={messageType === "success" ? "success-msg" : "error-msg"}>
                            {message}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                        <Field
                            label="Email"
                            value={form.email}
                            onChange={updateField("email")}
                        />
                        <Field
                            label="Password"
                            type="password"
                            value={form.password}
                            onChange={updateField("password")}
                        />

                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? "Sending..." : "Reset confirmation link"}
                        </button>
                    </form>

                    <div className="auth-switch">
                        <a onClick={() => navigate("/login")}>Back to Sign In</a>
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
