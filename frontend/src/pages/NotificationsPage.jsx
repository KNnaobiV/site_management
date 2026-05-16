import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationItem, InvitationDetailModal } from '../components';
import { Filter, CheckCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList } from '../api/client';

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('All');
  const [selectedInvitation, setSelectedInvitation] = useState(null);

  const getNotificationType = (message) => {
    const msg = (message || '').toLowerCase();
    if (msg.includes('invited')) return 'Invitations';
    if (msg.includes('accepted') || msg.includes('declined')) return 'Invitations';
    if (msg.includes('approval') || msg.includes('approved')) return 'Approvals';
    if (msg.includes('report')) return 'Reports';
    if (msg.includes('mentioned')) return 'Mentions';
    if (msg.includes('urgent') || msg.includes('delayed') || msg.includes('alert')) return 'Alerts';
    return 'System';
  };

  const filteredNotifications = notifications.filter((notification) => {
    if (activeTab === 'All') return true;
    return getNotificationType(notification.message) === activeTab;
  });

  const tabCounts = {
    All: notifications.length,
    Alerts: notifications.filter(n => getNotificationType(n.message) === 'Alerts').length,
    Mentions: notifications.filter(n => getNotificationType(n.message) === 'Mentions').length,
    Approvals: notifications.filter(n => getNotificationType(n.message) === 'Approvals').length,
    Reports: notifications.filter(n => getNotificationType(n.message) === 'Reports').length,
    Invitations: notifications.filter(n => getNotificationType(n.message) === 'Invitations').length,
  };

  const tabs = [
    { label: 'All', count: tabCounts.All },
    { label: 'Alerts', count: tabCounts.Alerts },
    { label: 'Mentions', count: tabCounts.Mentions },
    { label: 'Approvals', count: tabCounts.Approvals },
    { label: 'Reports', count: tabCounts.Reports },
    { label: 'Invitations', count: tabCounts.Invitations },
  ];

  useEffect(() => {
    const loadNotifications = async () => {
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
    loadNotifications();
  }, [token]);

  const findInvitationFromNotification = async (notification) => {
    const isInvitation = getNotificationType(notification.message) === 'Invitations';
    if (!isInvitation) return null;

    const paths = ['/invitations/projects/', '/invitations/plots/'];
    for (const path of paths) {
      try {
        const res = await apiFetch(path, { token });
        if (!res.ok) continue;
        const items = unwrapList(await res.json());
        const match = items.find(inv => inv.message === notification.message);
        if (match) return match;
      } catch (err) {
        console.error('Failed to lookup invitation list', err);
      }
    }
    return null;
  };

  const handleViewNotification = async (notification) => {
    if (notification.target_url && notification.target_url.startsWith('/invitations/')) {
      try {
        const res = await apiFetch(notification.target_url, { token });
        if (res.ok) {
          setSelectedInvitation(await res.json());
          return;
        }
      } catch (error) {
        console.error('Failed to load invitation details', error);
      }
    }

    const fallbackInvitation = await findInvitationFromNotification(notification);
    if (fallbackInvitation) {
      setSelectedInvitation(fallbackInvitation);
      return;
    }

    if (notification.target_url) {
      navigate(notification.target_url);
      return;
    }

    const type = getNotificationType(notification.message);
    if (type === 'Invitations') {
      navigate('/notifications');
      return;
    }
    if (notification.project) {
      navigate(`/projects/${notification.project}?tab=reports`);
      return;
    }
    navigate('/projects');
  };

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
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map(n => (
            <NotificationItem key={n.id} notification={n} onView={handleViewNotification} />
          ))
        ) : (
          <div style={{ padding: '40px', borderRadius: '20px', background: 'var(--bg-card)', color: 'var(--text-tertiary)', textAlign: 'center' }}>
            No notifications match this category yet.
          </div>
        )}
      </div>

      <InvitationDetailModal
        invitation={selectedInvitation}
        isOpen={!!selectedInvitation}
        onClose={() => setSelectedInvitation(null)}
      />
    </div>
  );
};

export default NotificationsPage;
