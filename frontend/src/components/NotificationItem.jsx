import React from 'react';
import Avatar from './Avatar';
import { UserPlus, ClipboardCheck, MessageSquare, AlertTriangle, CheckCircle2, Bell } from 'lucide-react';

const NotificationItem = ({ notification }) => {
  const getIcon = () => {
    const msg = notification.message?.toLowerCase() || '';
    if (msg.includes('invited')) return { icon: UserPlus, color: '#c14a1e', bg: '#fdf1ec' };
    if (msg.includes('approval') || msg.includes('approved')) return { icon: ClipboardCheck, color: '#8a6d3b', bg: '#fff8e1' };
    if (msg.includes('mentioned')) return { icon: MessageSquare, color: '#1a1a1a', bg: '#f0f0f0' };
    if (msg.includes('urgent') || msg.includes('delayed') || msg.includes('alert')) return { icon: AlertTriangle, color: '#a32a2a', bg: '#fdeded' };
    if (msg.includes('accepted')) return { icon: CheckCircle2, color: '#2d5a27', bg: '#edf5ed' };
    return { icon: Bell, color: '#8a8a8a', bg: '#f0f0f0' };
  };

  const getTypeLabel = () => {
    const msg = notification.message?.toLowerCase() || '';
    if (msg.includes('invited')) return 'Invitations';
    if (msg.includes('approval') || msg.includes('approved')) return 'Approvals';
    if (msg.includes('mentioned')) return 'Mentions';
    if (msg.includes('urgent') || msg.includes('delayed') || msg.includes('alert')) return 'Alerts';
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
    <div className="card" style={{ 
      display: 'flex', 
      gap: '20px', 
      padding: '20px',
      borderLeft: `4px solid ${color}`,
      alignItems: 'center'
    }}>
      <div style={{ 
        width: '48px', 
        height: '48px', 
        borderRadius: '50%', 
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Icon size={24} color={color} />
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '15px' }}>{notification.message}</p>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>{getTimeLabel()}</span>
        </div>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-tertiary)' }}>
          {notification.project_name || 'Project Name'} • {typeLabel}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        {notification.message?.toLowerCase().includes('approval') && (
          <button className="btn-ghost" style={{ fontSize: '12px', padding: '6px 12px', borderColor: 'var(--brand-orange)', color: 'var(--brand-orange)' }}>Approve</button>
        )}
        <button className="btn-ghost" style={{ fontSize: '12px', padding: '6px 12px' }}>View</button>
      </div>
    </div>
  );
};

export default NotificationItem;
