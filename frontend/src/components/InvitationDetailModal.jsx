import React from 'react';
import { X, Calendar, User, MessageSquare, Clock } from 'lucide-react';
import Avatar from './Avatar';

/**
 * InvitationDetailModal - Display detailed information about an invitation
 */
const InvitationDetailModal = ({ invitation, isOpen, onClose }) => {
  if (!isOpen || !invitation) return null;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'Pending': { bg: '#fef3ec', text: '#c14a1e' },
      'Accepted': { bg: '#e8f5e9', text: '#2d5a27' },
      'Declined': { bg: '#fce4ec', text: '#a32a2a' },
      'Revoked': { bg: '#f5f5f5', text: '#9e9e9e' },
      'Expired': { bg: '#fff3e0', text: '#e65100' },
    };
    return colors[status] || colors['Pending'];
  };

  const statusColor = getStatusColor(invitation.status);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '24px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-in"
        style={{
          background: 'var(--bg-card)',
          borderRadius: '24px',
          padding: '40px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.15)',
          position: 'relative',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-tertiary)',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
        >
          <X size={24} />
        </button>

        {/* Title */}
        <h2 style={{ fontSize: '28px', marginBottom: '6px', marginTop: 0 }}>
          {invitation.plot ? 'Plot Invitation' : 'Project Invitation'}
        </h2>

        {/* Status Badge */}
        <div style={{ marginBottom: '28px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 14px',
              borderRadius: '100px',
              background: statusColor.bg,
              color: statusColor.text,
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: statusColor.text,
              }}
            />
            {invitation.status}
          </span>
        </div>

        {/* Content Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Project/Plot Info */}
          <div>
            <p
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                margin: '0 0 8px',
              }}
            >
              {invitation.plot ? 'Plot' : 'Project'}
            </p>
            <p
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              {invitation.project_name || invitation.plot_address || 'Unknown'}
            </p>
          </div>

          {/* Role */}
          <div>
            <p
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                margin: '0 0 8px',
              }}
            >
              Role
            </p>
            <p
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              {invitation.role}
            </p>
          </div>

          {/* From */}
          <div>
            <p
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                margin: '0 0 12px',
              }}
            >
              Invited By
            </p>
            {invitation.invited_by && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Avatar
                  name={invitation.invited_by.display_name || invitation.invited_by.username}
                  size={40}
                />
                <div>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      margin: 0,
                    }}
                  >
                    {invitation.invited_by.display_name || invitation.invited_by.username}
                  </p>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-tertiary)',
                      margin: '4px 0 0',
                    }}
                  >
                    {invitation.invited_by.email}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <p
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  margin: '0 0 8px',
                }}
              >
                Sent
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} color="var(--text-tertiary)" />
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  {formatDate(invitation.created_at)}
                </p>
              </div>
            </div>
            <div>
              <p
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  margin: '0 0 8px',
                }}
              >
                Expires
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="var(--text-tertiary)" />
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                  {formatDate(invitation.expires_at)}
                </p>
              </div>
            </div>
          </div>

          {/* Message */}
          {invitation.message && (
            <div>
              <p
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  margin: '0 0 8px',
                }}
              >
                Message
              </p>
              <div
                style={{
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                }}
              >
                {invitation.message}
              </div>
            </div>
          )}

          {/* Responded At */}
          {invitation.responded_at && (
            <div>
              <p
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  margin: '0 0 8px',
                }}
              >
                Responded
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                {formatDate(invitation.responded_at)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvitationDetailModal;
