import React, { useState, useEffect } from 'react';
import { X, Send, Sparkles, AlertCircle, Bug, MessageSquare, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, formatApiError } from '../api/client';
import Spinner from './Spinner';

const CATEGORIES = [
  { id: 'Improvement', label: 'Improvement / Idea', icon: Sparkles },
  { id: 'Complaint', label: 'Complaint / Issue', icon: AlertCircle },
  { id: 'Bug Report', label: 'Bug Report', icon: Bug },
  { id: 'General Feedback', label: 'General Feedback', icon: MessageSquare },
];

const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: '12px',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-raised)',
  color: 'var(--text-primary)',
  fontSize: '14px',
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontWeight: 600,
  fontSize: '12px',
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const FeedbackModal = ({ isOpen, onClose }) => {
  const { user, token } = useAuth();
  const [category, setCategory] = useState('Improvement');
  const [subject, setSubject] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [image, setImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.display_name || user.username || '');
      setEmail(user.email || '');
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('subject', subject.trim());
      formData.append('name', name.trim());
      formData.append('email', email.trim());
      formData.append('message', message.trim());
      if (image) {
        formData.append('image', image);
      }

      const res = await apiFetch('/feedback/', {
        method: 'POST',
        token,
        body: formData,
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        const data = await res.json().catch(() => null);
        setError(formatApiError(data, 'Failed to send your feedback. Please try again.'));
      }
    } catch (err) {
      console.error('Feedback submission error:', err);
      setError('Connection error. Please check your internet connection.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setSuccess(false);
    setError(null);
    setSubject('');
    setMessage('');
    setImage(null);
    onClose();
  };

  return (
    <div
      onClick={handleResetAndClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3000,
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-in"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '24px',
          padding: '36px',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
          position: 'relative',
        }}
      >
        <button
          onClick={handleResetAndClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            padding: '6px',
            borderRadius: '8px',
          }}
          title="Close"
        >
          <X size={20} />
        </button>

        {success ? (
          <div style={{ textAlign: 'center', padding: '30px 10px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(34,197,94,0.12)',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <CheckCircle2 size={36} />
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 10px' }}>
              Thank You for Your Feedback!
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, margin: '0 0 28px' }}>
              Your message has been dispatched to our engineering and product team. We review every submission to make IronWork better.
            </p>
            <button
              onClick={handleResetAndClose}
              className="btn-primary"
              style={{ padding: '12px 32px', margin: '0 auto' }}
            >
              Back to Site
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span
                  style={{
                    background: 'var(--brand-orange)',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    letterSpacing: '0.06em',
                  }}
                >
                  BETA FEEDBACK
                </span>
              </div>
              <h2 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Improvements & Complaints
              </h2>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                Encountered a bug, have an idea for improvement, or have a complaint? Let us know and our team will follow up.
              </p>
            </div>

            {error && (
              <div
                style={{
                  background: 'rgba(220,38,38,0.1)',
                  border: '1px solid rgba(220,38,38,0.25)',
                  color: '#dc2626',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  marginBottom: '20px',
                  fontSize: '13px',
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Category selector */}
              <div>
                <label style={labelStyle}>Category <span style={{ color: "var(--brand-orange)" }}>*</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                  {CATEGORIES.map((cat) => {
                    const isSelected = category === cat.id;
                    const Icon = cat.icon;
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '12px',
                          border: isSelected ? '2px solid var(--brand-orange)' : '1px solid var(--border-default)',
                          background: isSelected ? 'rgba(249,115,22,0.1)' : 'var(--bg-raised)',
                          color: isSelected ? 'var(--brand-orange)' : 'var(--text-secondary)',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Icon size={14} />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label style={labelStyle}>Subject <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g., Export button on jobs or Plot report issue"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Submitter Name & Email */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Your Name <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
                  <input
                    type="text"
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Your Email <span style={{ color: "var(--brand-orange)" }}>*</span></label>
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Message */}
              <div>
                <label style={labelStyle}>Description / Details <span style={{ color: "var(--brand-orange)" }}>*</span></label>
                <textarea
                  required
                  rows={4}
                  placeholder="Please describe what you experienced, your suggested improvement, or your complaint in as much detail as possible..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    minHeight: '100px',
                    lineHeight: 1.6,
                  }}
                />
              </div>

              {/* Optional Image */}
              <div>
                <label style={labelStyle}>Attachment <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional Image)</span></label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImage(e.target.files[0] || null)}
                  style={{
                    ...inputStyle,
                    padding: '8px',
                    cursor: 'pointer'
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="btn-ghost"
                  style={{ flex: 1, padding: '12px' }}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    flex: 2,
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Spinner size={16} /> Sending...
                    </>
                  ) : (
                    <>
                      <Send size={16} /> Send Message
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default FeedbackModal;
