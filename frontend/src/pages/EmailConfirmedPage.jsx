import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { confirmEmail } from "../api/auth";
import "../styles/login.css";

export default function EmailConfirmedPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const confirmKey = searchParams.get("confirm_key");

    const [status, setStatus] = useState("verifying"); // verifying, success, error
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!confirmKey) {
            setStatus("error");
            setMessage("Invalid confirmation link.");
            return;
        }

        confirmEmail(confirmKey)
            .then(() => {
                setStatus("success");
            })
            .catch((err) => {
                setStatus("error");
                setMessage(err.message || "Failed to confirm email.");
            });
    }, [confirmKey]);

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
                    <h1 style={{ color: "white" }}>Almost there...</h1>
                    <p>We are verifying your email address so you can access your workspace securely.</p>
                </div>
            </div>

            <div className="auth-form-wrap">
                <div className="auth-form-inner fade-in">
                    {status === "verifying" && (
                        <div style={{ textAlign: "center", padding: "2rem 0" }}>
                            <h2 style={{ color: "black", marginBottom: "1rem" }}>Verifying Email</h2>
                            <p style={{ color: "var(--text-secondary)" }}>Please wait while we confirm your email address...</p>
                        </div>
                    )}

                    {status === "success" && (
                        <div style={{ textAlign: "center", padding: "2rem 0" }}>
                            <div style={{ marginBottom: "1rem", color: "var(--success, #10b981)" }}>
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                            </div>
                            <h2 style={{ color: "black", marginBottom: "1rem" }}>Email Confirmed</h2>
                            <p style={{ marginBottom: "2rem", color: "var(--text-secondary)" }}>Your email address has been successfully verified. You can now access your workspace.</p>
                            <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                                <button className="btn-primary" onClick={() => navigate("/login")} style={{ width: "fit-content", minWidth: "200px" }}>
                                    Click here to login
                                </button>
                            </div>
                        </div>
                    )}

                    {status === "error" && (
                        <div style={{ textAlign: "center", padding: "2rem 0" }}>
                            <div style={{ marginBottom: "1rem", color: "var(--error, #ef4444)" }}>
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="15" y1="9" x2="9" y2="15"></line>
                                    <line x1="9" y1="9" x2="15" y2="15"></line>
                                </svg>
                            </div>
                            <h2 style={{ color: "black", marginBottom: "1rem" }}>Verification Failed</h2>
                            <p style={{ marginBottom: "2rem", color: "var(--text-secondary)" }}>{message}</p>
                            <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                                <button className="btn-primary" onClick={() => navigate("/login")} style={{ width: "fit-content", minWidth: "200px" }}>
                                    Go to Login
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
