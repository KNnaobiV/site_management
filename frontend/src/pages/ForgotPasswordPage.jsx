import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../api/auth";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setMessage("");
        setError("");
        setLoading(true);
        try {
            const res = await requestPasswordReset(email);
            setMessage(res.message);
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
                    <h1>Recover your <em>account</em></h1>
                    <p>Enter your email address and we'll send you a link to reset your password.</p>
                </div>
                <div />
            </div>

            <div className="auth-form-wrap">
                <div className="auth-form-inner fade-in">
                    <h2>Forgot password</h2>
                    <p>Enter your email to receive a reset link</p>

                    {message && <div className="success-msg">{message}</div>}
                    {error && <div className="error-msg">{error}</div>}

                    {!message && (
                        <form onSubmit={handleSubmit}>
                            <div className="field-group">
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    required
                                />
                            </div>
                            <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%" }}>
                                {loading ? "Sending..." : "Send reset link"}
                            </button>
                        </form>
                    )}

                    <div className="auth-switch">
                        <Link to="/">Back to sign in</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

