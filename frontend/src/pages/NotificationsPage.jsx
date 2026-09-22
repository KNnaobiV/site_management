import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationItem, InvitationDetailModal, FilterSortDropdown } from '../components';
import { Filter, CheckCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList } from '../api/client';

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('Unread');
  const [selectedInvitation, setSelectedInvitation] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [sortBy, setSortBy] = useState('desc');
  const [filterContext, setFilterContext] = useState('all');

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

  const getNotificationContext = (notification) => {
    const url = notification.target_url || '';
    if (url.includes('/job-items/')) return 'job';
    if (url.includes('/work-items/')) return 'work';
    if (url.includes('/plots/') && !url.includes('/work-items/')) return 'plot';
    if (url.includes('/projects/')) return 'project';
    return 'other';
  };

  const getNotificationType = (message) => {
    const msg = (message || '').toLowerCase();
    if (msg.includes('invited')) return 'Invitations';
    if (msg.includes('accepted') || msg.includes('declined')) return 'Invitations';
    if (msg.includes('approval') || msg.includes('approved')) return 'Approvals';
    if (msg.includes('comment')) return 'Comments';
    if (msg.includes('report')) return 'Reports';
    if (msg.includes('urgent') || msg.includes('delayed') || msg.includes('alert') || msg.includes('critical')) return 'Alerts';
    return 'System';
  };

  const isAlert = (notification) => {
    const msg = (notification.message || '').toLowerCase();
    const type = getNotificationType(notification.message);
    return (
      notification.priority === 'High' ||
      notification.priority === 'Urgent' ||
      type === 'Alerts' ||
      msg.includes('urgent') ||
      msg.includes('alert') ||
      msg.includes('exceeded') ||
      msg.includes('deletion') ||
      msg.includes('warning')
    );
  };

  const isApproval = (notification) => {
    const msg = (notification.message || '').toLowerCase();
    const type = getNotificationType(notification.message);
    return (
      type === 'Approvals' ||
      msg.includes('approval') ||
      msg.includes('approved') ||
      msg.includes('review') ||
      msg.includes('rejected')
    );
  };

  const isInvitation = (notification) => {
    const msg = (notification.message || '').toLowerCase();
    const type = getNotificationType(notification.message);
    return (
      type === 'Invitations' ||
      msg.includes('invited') ||
      msg.includes('invitation') ||
      msg.includes('accepted') ||
      msg.includes('declined')
    );
  };

  const filteredNotifications = notifications.filter((notification) => {
    if (activeTab === 'Unread' && notification.is_read) return false;
    if (activeTab === 'Read' && !notification.is_read) return false;
    if (activeTab === 'Alerts' && (notification.is_read || !isAlert(notification))) return false;
    if (activeTab === 'Approvals' && (notification.is_read || !isApproval(notification))) return false;
    if (activeTab === 'Invitations' && (notification.is_read || !isInvitation(notification))) return false;

    if (filterContext !== 'all') {
      if (getNotificationContext(notification) !== filterContext) return false;
    }
    return true;
  }).sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return sortBy === 'desc' ? dateB - dateA : dateA - dateB;
  });

  const unreadAlertsCount = notifications.filter(n => !n.is_read && isAlert(n)).length;
  const unreadApprovalsCount = notifications.filter(n => !n.is_read && isApproval(n)).length;
  const unreadInvitationsCount = notifications.filter(n => !n.is_read && isInvitation(n)).length;

  const tabCounts = {
    Unread: notifications.filter(n => !n.is_read).length,
    Read: notifications.filter(n => n.is_read).length,
    Alerts: unreadAlertsCount,
    Approvals: unreadApprovalsCount,
    Invitations: unreadInvitationsCount,
  };

  const tabs = [
    { label: 'Unread', count: tabCounts.Unread },
    { label: 'Read', count: tabCounts.Read },
    { label: 'Alerts', count: tabCounts.Alerts },
    { label: 'Approvals', count: tabCounts.Approvals },
    { label: 'Invitations', count: tabCounts.Invitations },
  ];

  const handleMarkAsRead = async (notification) => {
    if (notification.is_read) return;
    try {
      await apiFetch(`/notifications/${notification.id}/read/`, { method: 'POST', token });
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiFetch('/notifications/read_all/', { method: 'POST', token });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const findInvitationFromNotification = async (notification) => {
    const isInvitation = getNotificationType(notification.message) === 'Invitations';
    if (!isInvitation) return null;

    const preferredOrder = notification.message?.toLowerCase().includes('plot')
      ? ['/invitations/plots/', '/invitations/projects/']
      : ['/invitations/projects/', '/invitations/plots/'];

    for (const path of preferredOrder) {
      try {
        const res = await apiFetch(path, { token });
        if (!res.ok) continue;

        const items = unwrapList(await res.json());
        const matches = items.filter(inv => (
          inv.invitee?.id === user?.id || inv.invited_by?.id === user?.id
        ));

        if (matches.length > 0) {
          const exactMessage = matches.find(inv => inv.message === notification.message);
          if (exactMessage) return exactMessage;

          const byProject = matches.find(inv => inv.project === notification.project);
          if (byProject) return byProject;

          return matches[0];
        }
      } catch (err) {
        console.error('Failed to lookup invitation list', err);
      }
    }
    return null;
  };

  const handleViewNotification = async (notification) => {
    await handleMarkAsRead(notification);

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
    <div className="fade-up" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '120px', minHeight: '100%' }}>
      <div className="mobile-stack mobile-stack-start" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 48px)', marginBottom: '8px' }}>Notifications</h1>
          <p style={{ fontSize: '16px', color: 'var(--text-tertiary)' }}>Stay on top of approvals, alerts and comments</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="btn-ghost" onClick={handleMarkAllAsRead} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCheck size={18} color="var(--brand-orange)" />
            <span style={{ color: 'var(--brand-orange)' }}>Mark all as read</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '28px', alignItems: 'center' }}>
        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          flex: 1
        }}>
          {tabs.map(tab => (
            <button
              key={tab.label}
              onClick={() => setActiveTab(tab.label)}
              style={{
                padding: '8px 16px',
                borderRadius: '12px',
                border: activeTab === tab.label ? 'none' : '1px solid var(--border-default)',
                background: activeTab === tab.label ? '#1a1a1a' : 'transparent',
                color: activeTab === tab.label ? '#fff' : 'var(--text-primary)',
                fontSize: '14px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                flexShrink: 0
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
        
        <FilterSortDropdown
          icon={Filter}
          label="Filter"
          value={filterContext}
          onChange={setFilterContext}
          options={[
            { label: 'All', value: 'all' },
            { label: 'Projects', value: 'project' },
            { label: 'Plots', value: 'plot' },
            { label: 'Work Items', value: 'work' },
            { label: 'Job Items', value: 'job' },
          ]}
        />
        <FilterSortDropdown
          label="Sort"
          value={sortBy}
          onChange={setSortBy}
          options={[
            { label: 'Recent First', value: 'desc' },
            { label: 'Oldest First', value: 'asc' },
          ]}
        />
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
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
        onClose={() => {
          setSelectedInvitation(null);
          setActionError(null);
        }}
        onAction={async (invitation, action) => {
          setActionError(null);
          const kind = invitation.plot ? 'plots' : 'projects';
          const res = await apiFetch(`/invitations/${kind}/${invitation.id}/${action}/`, {
            method: 'POST',
            token,
          });
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.detail || 'Unable to perform action.');
          }
          const updated = await res.json();
          setSelectedInvitation(updated);
          setNotifications((prev) => prev.map((n) => n.id === updated.id ? n : n));
          return updated;
        }}
      />
      {actionError && (
        <div style={{ marginTop: '16px', color: '#dc2626', fontSize: '14px' }}>
          {actionError}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
