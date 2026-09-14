import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../api/auth';
import { User, Save, ArrowLeft, Camera, Upload, Trash2, X } from 'lucide-react';
import { Spinner, Breadcrumb, Avatar } from '../components';
import { showSuccessMessage } from '../utils/successMessage';

export default function EditProfilePage() {
    const { user, setUser, token } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    
    const [profileForm, setProfileForm] = useState({
        first_name: user?.first_name || '',
        last_name: user?.last_name || '',
        display_name: user?.display_name || '',
        username: user?.username || ''
    });

    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [loading, setLoading] = useState(false);
    const [profileError, setProfileError] = useState('');

    const handlePhotoSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedPhoto(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleUploadPhoto = async () => {
        if (!selectedPhoto) return;
        setUploadingPhoto(true);
        setProfileError('');
        try {
            const formData = new FormData();
            formData.append('profile_picture', selectedPhoto);
            const updatedUser = await updateProfile(token, formData);
            setUser(updatedUser);
            setSelectedPhoto(null);
            setPreviewUrl(null);
            showSuccessMessage("Profile picture uploaded successfully");
        } catch (error) {
            setProfileError(error.message);
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleRemovePhoto = async () => {
        if (selectedPhoto) {
            setSelectedPhoto(null);
            setPreviewUrl(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        // Remove existing profile picture
        setUploadingPhoto(true);
        setProfileError('');
        try {
            const formData = new FormData();
            formData.append('profile_picture', '');
            const updatedUser = await updateProfile(token, formData);
            setUser(updatedUser);
            showSuccessMessage("Profile picture removed");
        } catch (error) {
            setProfileError(error.message);
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleProfileChange = (e) => {
        setProfileForm({ ...profileForm, [e.target.name]: e.target.value });
    };

    const submitProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        setProfileError('');
        try {
            let dataToSend;
            if (selectedPhoto) {
                dataToSend = new FormData();
                Object.keys(profileForm).forEach(key => {
                    dataToSend.append(key, profileForm[key]);
                });
                dataToSend.append('profile_picture', selectedPhoto);
            } else {
                dataToSend = profileForm;
            }
            const updatedUser = await updateProfile(token, dataToSend);
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
                    {/* Profile Photo Section */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px',
                        padding: '20px',
                        background: 'var(--bg-canvas)',
                        borderRadius: '16px',
                        border: '1px solid var(--border-subtle)',
                        flexWrap: 'wrap'
                    }}>
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            onChange={handlePhotoSelect}
                            style={{ display: 'none' }}
                        />
                        <Avatar
                            image={previewUrl}
                            user={!previewUrl ? user : undefined}
                            size={72}
                            style={{ fontSize: '26px', border: '2px solid var(--border-default)' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '200px' }}>
                            <div>
                                <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>Profile Picture</span>
                                <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    {selectedPhoto ? selectedPhoto.name : "PNG, JPG or WEBP (square works best)"}
                                </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="btn-secondary"
                                    style={{ padding: '8px 16px', fontSize: '13px' }}
                                >
                                    <Camera size={15} /> Choose Photo
                                </button>

                                {selectedPhoto && (
                                    <button
                                        type="button"
                                        onClick={handleUploadPhoto}
                                        disabled={uploadingPhoto}
                                        className="btn-primary"
                                        style={{ padding: '8px 18px', fontSize: '13px' }}
                                    >
                                        {uploadingPhoto ? <Spinner size={14} /> : <><Upload size={14} /> Upload</>}
                                    </button>
                                )}

                                {(selectedPhoto || user?.profile_picture) && (
                                    <button
                                        type="button"
                                        onClick={handleRemovePhoto}
                                        disabled={uploadingPhoto}
                                        className="btn-ghost"
                                        style={{ padding: '8px 14px', fontSize: '13px', color: 'var(--status-delayed)' }}
                                    >
                                        {selectedPhoto ? <><X size={14} /> Cancel</> : <><Trash2 size={14} /> Remove Photo</>}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <label style={labelStyle}>First Name <span style={{ color: "var(--brand-orange)" }}>*</span></label>
                            <input
                                type="text"
                                name="first_name"
                                value={profileForm.first_name}
                                onChange={handleProfileChange}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Last Name <span style={{ color: "var(--brand-orange)" }}>*</span></label>
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
                        <label style={labelStyle}>Display Name <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
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
                        <label style={labelStyle}>Username <span style={{ color: "var(--brand-orange)" }}>*</span></label>
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
