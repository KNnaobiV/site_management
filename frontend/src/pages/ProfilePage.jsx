import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Edit2, ChevronRight } from 'lucide-react';
import { Breadcrumb, Avatar } from '../components';

export default function ProfilePage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    
    return (
        <div className="fade-up" style={{ padding: '0 0 80px' }}>
            <div style={{ marginBottom: '32px' }}>
                <Breadcrumb items={[
                    { label: 'Dashboard', path: '/' },
                    { label: 'Profile' }
                ]} />
                <h1 style={{ fontSize: '64px', marginTop: '12px' }}>Profile Settings</h1>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '48px', maxWidth: '800px' }}>
                {/* Profile Overview */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', background: 'var(--bg-card)', padding: '32px', borderRadius: '24px', border: '1px solid var(--border-default)' }}>
                    <Avatar user={user} size={100} style={{ fontSize: '36px' }} />
                    <div>
                        <h2 style={{ margin: '0 0 8px', fontSize: '32px' }}>{user?.display_name || user?.first_name || user?.username}</h2>
                        <p style={{ margin: '0 0 4px', fontSize: '16px', color: 'var(--text-secondary)' }}>@{user?.username}</p>
                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-tertiary)' }}>{user?.role}</p>
                    </div>
                </div>

                {/* Navigation Links */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <button 
                        onClick={() => navigate('/profile/edit')}
                        style={linkCardStyle}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={iconWrapperStyle}>
                                <User size={24} color="var(--brand-orange)" />
                            </div>
                            <div style={{ textAlign: 'left' }}>
                                <h3 style={{ margin: '0 0 4px', fontSize: '18px', color: 'var(--text-primary)' }}>Edit Profile</h3>
                                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Update your name, username, and display details.</p>
                            </div>
                        </div>
                        <ChevronRight size={24} color="var(--text-tertiary)" />
                    </button>

                    <button 
                        onClick={() => navigate('/profile/update-password')}
                        style={linkCardStyle}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={iconWrapperStyle}>
                                <Lock size={24} color="var(--brand-orange)" />
                            </div>
                            <div style={{ textAlign: 'left' }}>
                                <h3 style={{ margin: '0 0 4px', fontSize: '18px', color: 'var(--text-primary)' }}>Update Password</h3>
                                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Change your account password for security.</p>
                            </div>
                        </div>
                        <ChevronRight size={24} color="var(--text-tertiary)" />
                    </button>
                </div>
            </div>
        </div>
    );
}

const linkCardStyle = {
    background: 'var(--bg-card)',
    borderRadius: '20px',
    border: '1px solid var(--border-default)',
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    width: '100%',
    textAlign: 'left'
};

const iconWrapperStyle = {
    background: 'var(--bg-raised)',
    padding: '16px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};
