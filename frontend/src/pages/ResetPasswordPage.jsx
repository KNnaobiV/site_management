import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { confirmPasswordReset } from "../api/auth";
import "../styles/login.css";

export default function ResetPasswordPage() {
    const { uid, token } = useParams();
    const navigate = useNavigate();
    
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setMessage("");
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        
        if (password.length < 6) {
            setError("Password should be at least 6 characters long.");
            return;
        }

        setLoading(true);
        try {
            const res = await confirmPasswordReset(uid, token, password);
            setMessage(res.detail || "Password has been reset successfully.");
            setSuccess(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-wrap">
            <div className="auth-panel">
                <div className="brand-mark">
                    <span className="brand-name">Buildstack</span>
                </div>
                <div className="panel-copy">
                    <h1>Set new <em>password</em></h1>
                    <p>Enter a new password to access your account.</p>
                </div>
            </div>

            <div className="auth-form-wrap">
                <div className="auth-form-inner fade-in">
                    <h2>Reset Password</h2>
                    
                    {success ? (
                        <div style={{ textAlign: "center", padding: "1rem 0" }}>
                            <div className="success-msg" style={{ marginBottom: "2rem" }}>
                                {message}
                            </div>
                            <button className="btn-primary" onClick={() => navigate("/login")}>
                                Go to login
                            </button>
                        </div>
                    ) : (
                        <>
                            <p>Enter your new password below</p>
                            {error && <div className="error-msg">{error}</div>}

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
                                <Field
                                    label="New Password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <Field
                                    label="Confirm New Password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                                
                                <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%", marginTop: '10px' }}>
                                    {loading ? "Saving..." : "Reset password"}
                                </button>
                            </form>

                            <div className="auth-switch">
                                <Link to="/login">Back to sign in</Link>
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
                    required
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
