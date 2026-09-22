import React from 'react';
import Avatar from './Avatar';
import { UserPlus, ClipboardCheck, MessageSquare, AlertTriangle, CheckCircle2, Bell, FileText } from 'lucide-react';

const NotificationItem = ({ notification, onView }) => {
  const getIcon = () => {
    const msg = notification.message?.toLowerCase() || '';
    if (msg.includes('invited')) return { icon: UserPlus, color: '#c14a1e', bg: '#fdf1ec' };
    if (msg.includes('approval') || msg.includes('approved')) return { icon: ClipboardCheck, color: '#8a6d3b', bg: '#fff8e1' };
    if (msg.includes('comment')) return { icon: MessageSquare, color: '#1a1a1a', bg: '#f0f0f0' };
    if (msg.includes('report')) return { icon: FileText, color: '#1a1a1a', bg: '#f0f0f0' };
    if (msg.includes('urgent') || msg.includes('delayed') || msg.includes('alert') || msg.includes('critical')) return { icon: AlertTriangle, color: '#a32a2a', bg: '#fdeded' };
    if (msg.includes('accepted') || msg.includes('declined')) return { icon: CheckCircle2, color: '#2d5a27', bg: '#edf5ed' };
    return { icon: Bell, color: '#8a8a8a', bg: '#f0f0f0' };
  };

  const getTypeLabel = () => {
    const msg = notification.message?.toLowerCase() || '';
    if (msg.includes('invited')) return 'Invitations';
    if (msg.includes('approval') || msg.includes('approved')) return 'Approvals';
    if (msg.includes('comment')) return 'Comments';
    if (msg.includes('report')) return 'Reports';
    if (msg.includes('urgent') || msg.includes('delayed') || msg.includes('alert') || msg.includes('critical')) return 'Alerts';
    if (msg.includes('accepted') || msg.includes('declined')) return 'Invitations';
    return 'System';
  };

  const getTimeLabel = () => {
    if (!notification.created_at) return '';
    const diff = Math.floor((Date.now() - new Date(notification.created_at).getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    const hours = Math.floor(diff / 60);
    return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
  };

  const { icon: Icon, color, bg } = getIcon();
  const typeLabel = notification.type || getTypeLabel();

  return (
    <div className="card notification-card" style={{
      display: 'flex',
      gap: '14px',
      padding: '16px 18px',
      borderLeft: `4px solid ${color}`,
      alignItems: 'center',
      minWidth: 0,
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <div style={{
        width: '42px',
        height: '42px',
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Icon size={20} color={color} />
      </div>

      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', lineHeight: 1.4, wordBreak: 'break-word', color: 'var(--text-primary)' }}>{notification.message}</p>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '11px', whiteSpace: 'nowrap', flexShrink: 0 }}>{getTimeLabel()}</span>
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)', wordBreak: 'break-word' }}>
          {notification.project_name || 'Project Name'} • {typeLabel}
        </p>
      </div>

      <div className="notification-actions" style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        {notification.message?.toLowerCase().includes('approval') && (
          <button className="btn-ghost" style={{ fontSize: '12px', padding: '5px 10px', borderColor: 'var(--brand-orange)', color: 'var(--brand-orange)' }}>Approve</button>
        )}
        <button
          className="btn-ghost"
          style={{ fontSize: '12px', padding: '5px 10px' }}
          onClick={() => onView?.(notification)}
          type="button"
        >
          View
        </button>
      </div>
    </div>
  );
};

export default NotificationItem;
