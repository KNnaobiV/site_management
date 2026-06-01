import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { changePassword } from '../api/auth';
import { Lock, Save, Eye, EyeOff } from 'lucide-react';
import { Spinner, Breadcrumb } from '../components';
import { showSuccessMessage } from '../utils/successMessage';

export default function UpdatePasswordPage() {
    const { token } = useAuth();
    const navigate = useNavigate();
    
    const [passwordForm, setPasswordForm] = useState({
        old_password: '',
        new_password: '',
        confirm_password: ''
    });

    const [pwLoading, setPwLoading] = useState(false);
    const [pwError, setPwError] = useState('');

    const handlePasswordChange = (e) => {
        setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });
    };

    const submitPassword = async (e) => {
        e.preventDefault();
        if (passwordForm.new_password !== passwordForm.confirm_password) {
            setPwError("New passwords do not match");
            return;
        }
        if (passwordForm.new_password.length < 6) {
            setPwError("Password should be at least 6 characters long.");
            return;
        }
        setPwLoading(true);
        setPwError('');
        try {
            await changePassword(token, {
                old_password: passwordForm.old_password,
                new_password: passwordForm.new_password
            });
            showSuccessMessage("Password changed successfully");
            navigate('/profile');
        } catch (error) {
            setPwError(error.message);
        } finally {
            setPwLoading(false);
        }
    };

    return (
        <div className="fade-up" style={{ padding: '0 0 80px' }}>
            <div style={{ marginBottom: '32px' }}>
                <Breadcrumb items={[
                    { label: 'Profile', path: '/profile' },
                    { label: 'Update Password' }
                ]} />
                <h1 style={{ fontSize: '64px', marginTop: '12px' }}>Update Password</h1>
            </div>

            <form onSubmit={submitPassword} className="mobile-padding" style={cardStyle}>
                <div style={cardHeaderStyle}>
                    <Lock size={24} color="var(--brand-orange)" />
                    <h2 style={{ margin: 0, fontSize: '24px' }}>Change Password</h2>
                </div>
                
                {pwError && <div style={errorMsgStyle}>{pwError}</div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <PasswordField
                        label="Current Password"
                        name="old_password"
                        value={passwordForm.old_password}
                        onChange={handlePasswordChange}
                    />
                    <PasswordField
                        label="New Password"
                        name="new_password"
                        value={passwordForm.new_password}
                        onChange={handlePasswordChange}
                    />
                    <PasswordField
                        label="Confirm New Password"
                        name="confirm_password"
                        value={passwordForm.confirm_password}
                        onChange={handlePasswordChange}
                    />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '24px' }}>
                        <button type="button" onClick={() => navigate('/profile')} className="btn-ghost" style={{ padding: '12px 32px' }}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={pwLoading} style={{ padding: '12px 32px' }}>
                            {pwLoading ? <Spinner size={20} /> : <><Save size={18} /> Update Password</>}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}

function PasswordField({ label, name, value, onChange }) {
    const [show, setShow] = useState(false);
    return (
        <div>
            <label style={labelStyle}>{label}</label>
            <div style={{ position: 'relative' }}>
                <input
                    type={show ? "text" : "password"}
                    name={name}
                    value={value}
                    onChange={onChange}
                    required
                    style={{ ...inputStyle, paddingRight: '48px' }}
                />
                <button
                    type="button"
                    onClick={() => setShow(!show)}
                    style={{
                        position: 'absolute',
                        right: '16px',
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
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>
        </div>
    );
}

const cardStyle = {
    background: 'var(--bg-card)',
    borderRadius: '24px',
    border: '1px solid var(--border-default)',
    padding: '48px',
    maxWidth: '600px',
    display: 'flex',
    flexDirection: 'column',
    gap: '32px'
};

const cardHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
};

const labelStyle = {
    display: 'block',
    marginBottom: '10px',
    fontWeight: 600,
    fontSize: '15px',
    color: 'var(--text-primary)'
};

const inputStyle = {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid var(--border-default)',
    background: 'var(--bg-canvas)',
    color: 'var(--text-primary)',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s'
};

const errorMsgStyle = {
    padding: '16px',
    background: 'rgba(235, 87, 87, 0.1)',
    color: 'var(--status-delayed)',
    borderRadius: '12px',
    fontSize: '14px',
    border: '1px solid rgba(235, 87, 87, 0.2)'
};
