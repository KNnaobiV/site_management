import React from 'react';
import Avatar from './Avatar';
import { UserPlus, ClipboardCheck, MessageSquare, AlertTriangle, CheckCircle2, Bell } from 'lucide-react';

const NotificationItem = ({ notification }) => {
  const getIcon = () => {
    const msg = notification.message?.toLowerCase() || '';
    if (msg.includes('invited')) return { icon: UserPlus, color: '#c14a1e', bg: '#fdf1ec' };
    if (msg.includes('approval')) return { icon: ClipboardCheck, color: '#8a6d3b', bg: '#fff8e1' };
    if (msg.includes('mentioned')) return { icon: MessageSquare, color: '#1a1a1a', bg: '#f0f0f0' };
    if (msg.includes('urgent') || msg.includes('delayed')) return { icon: AlertTriangle, color: '#a32a2a', bg: '#fdeded' };
    if (msg.includes('accepted')) return { icon: CheckCircle2, color: '#2d5a27', bg: '#edf5ed' };
    return { icon: Bell, color: '#8a8a8a', bg: '#f0f0f0' };
  };

  const { icon: Icon, color, bg } = getIcon();

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
          <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>2m ago</span>
        </div>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-tertiary)' }}>
          {notification.project_name || 'Project Name'} • {notification.type || 'System'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        {notification.message?.includes('approval') && (
          <button className="btn-ghost" style={{ fontSize: '12px', padding: '6px 12px', borderColor: 'var(--brand-orange)', color: 'var(--brand-orange)' }}>Approve</button>
        )}
        <button className="btn-ghost" style={{ fontSize: '12px', padding: '6px 12px' }}>View</button>
      </div>
    </div>
  );
};

export default NotificationItem;
