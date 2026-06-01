import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../api/auth';
import { User, Save, ArrowLeft } from 'lucide-react';
import { Spinner, Breadcrumb } from '../components';
import { showSuccessMessage } from '../utils/successMessage';

export default function EditProfilePage() {
    const { user, setUser, token } = useAuth();
    const navigate = useNavigate();
    
    const [profileForm, setProfileForm] = useState({
        first_name: user?.first_name || '',
        last_name: user?.last_name || '',
        display_name: user?.display_name || '',
        username: user?.username || ''
    });

    const [loading, setLoading] = useState(false);
    const [profileError, setProfileError] = useState('');

    const handleProfileChange = (e) => {
        setProfileForm({ ...profileForm, [e.target.name]: e.target.value });
    };

    const submitProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        setProfileError('');
        try {
            const updatedUser = await updateProfile(token, profileForm);
            setUser(updatedUser);
            showSuccessMessage("Profile updated successfully");
            navigate('/profile');
        } catch (error) {
            setProfileError(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fade-up" style={{ padding: '0 0 80px' }}>
            <div style={{ marginBottom: '32px' }}>
                <Breadcrumb items={[
                    { label: 'Profile', path: '/profile' },
                    { label: 'Edit Profile' }
                ]} />
                <h1 style={{ fontSize: '64px', marginTop: '12px' }}>Edit Profile</h1>
            </div>

            <form onSubmit={submitProfile} className="mobile-padding" style={cardStyle}>
                <div style={cardHeaderStyle}>
                    <User size={24} color="var(--brand-orange)" />
                    <h2 style={{ margin: 0, fontSize: '24px' }}>Profile Details</h2>
                </div>
                
                {profileError && <div style={errorMsgStyle}>{profileError}</div>}
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <label style={labelStyle}>First Name</label>
                            <input
                                type="text"
                                name="first_name"
                                value={profileForm.first_name}
                                onChange={handleProfileChange}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Last Name</label>
                            <input
                                type="text"
                                name="last_name"
                                value={profileForm.last_name}
                                onChange={handleProfileChange}
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={labelStyle}>Display Name</label>
                        <input
                            type="text"
                            name="display_name"
                            value={profileForm.display_name}
                            onChange={handleProfileChange}
                            style={inputStyle}
                            placeholder="How your name appears to others"
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>Username</label>
                        <input
                            type="text"
                            name="username"
                            value={profileForm.username}
                            onChange={handleProfileChange}
                            style={inputStyle}
                            required
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '24px' }}>
                        <button type="button" onClick={() => navigate('/profile')} className="btn-ghost" style={{ padding: '12px 32px' }}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '12px 32px' }}>
                            {loading ? <Spinner size={20} /> : <><Save size={18} /> Save Profile</>}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}

const cardStyle = {
    background: 'var(--bg-card)',
    borderRadius: '24px',
    border: '1px solid var(--border-default)',
    padding: '48px',
    maxWidth: '800px',
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
