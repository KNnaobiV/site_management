import React, { useState, useEffect } from 'react';
import { NotificationItem } from '../components';
import { Filter, CheckCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList } from '../api/client';

const NotificationsPage = () => {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('All');

  const tabs = [
    { label: 'All', count: 12 },
    { label: 'Alerts', count: 4 },
    { label: 'Mentions', count: 3 },
    { label: 'Approvals', count: 3 },
    { label: 'Urgent', count: 2 },
  ];

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await apiFetch("/notifications/", { token });
      if (res.ok) {
        const data = await res.json();
        setNotifications(unwrapList(data));
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Mocking more detailed notifications for display
  const displayNotifications = [
    { id: 1, message: "You've been invited to 'Maple Heights Tower' as Consultant", project_name: 'Maple Heights Tower', type: 'Invitations' },
    { id: 2, message: "Job report on Plot B-14 awaits your approval", project_name: 'Maple Heights Tower', type: 'Job Items' },
    { id: 3, message: "Sarah mentioned you in a comment on 'Roofing & Waterproofing'", project_name: 'Maple Heights Tower', type: 'Work Items' },
    { id: 4, message: "URGENT: Concrete pour delayed on Plot A-02", project_name: 'Maple Heights Tower', type: 'Alerts' },
    { id: 5, message: "Foreman invitation accepted by J. Adeyemi", project_name: 'Maple Heights Tower', type: 'Invitations' },
    { id: 6, message: "Daily progress report is overdue for Plot C-07", project_name: 'Maple Heights Tower', type: 'Alerts' },
  ];

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '48px', marginBottom: '8px' }}>Notifications</h1>
          <p style={{ fontSize: '16px', color: 'var(--text-tertiary)' }}>Stay on top of approvals, alerts and mentions</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCheck size={18} color="var(--brand-orange)" />
            <span style={{ color: 'var(--brand-orange)' }}>Mark all as read</span>
          </button>
          <button className="btn-ghost">
            <Filter size={18} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
        {tabs.map(tab => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(tab.label)}
            style={{
              padding: '8px 20px',
              borderRadius: '12px',
              border: activeTab === tab.label ? 'none' : '1px solid var(--border-default)',
              background: activeTab === tab.label ? '#1a1a1a' : 'transparent',
              color: activeTab === tab.label ? '#fff' : 'var(--text-primary)',
              fontSize: '14px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {tab.label}
            <span style={{ 
              background: activeTab === tab.label ? 'rgba(255,255,255,0.2)' : 'var(--bg-raised)',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '12px'
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {displayNotifications.map(n => (
          <NotificationItem key={n.id} notification={n} />
        ))}
      </div>
    </div>
  );
};

export default NotificationsPage;
