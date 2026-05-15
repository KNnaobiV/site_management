import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Breadcrumb, Spinner } from '../components';
import { CheckCircle2, XCircle, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList } from '../api/client';
import { showSuccessMessage } from '../utils/successMessage';

const InvitationsPage = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [projectInvites, setProjectInvites] = useState([]);
  const [plotInvites, setPlotInvites] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    setLoading(true);
    setError(null);

    try {
      const [projRes, plotRes] = await Promise.all([
        apiFetch('/invitations/projects/', { token }),
        apiFetch('/invitations/plots/', { token }),
      ]);

      if (projRes.ok) {
        setProjectInvites(unwrapList(await projRes.json()));
      }
      if (plotRes.ok) {
        setPlotInvites(unwrapList(await plotRes.json()));
      }
    } catch (err) {
      console.error('Failed to load invitations', err);
      setError('Unable to load invitations.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async ({ id, kind, action }) => {
    const confirmMessage = action === 'accept'
      ? 'Accept this invitation?'
      : action === 'decline'
        ? 'Decline this invitation?'
        : 'Revoke this invitation?';

    if (!window.confirm(confirmMessage)) return;

    setError(null);
    try {
      const url = `/invitations/${kind}/${id}/${action}/`;
      const res = await apiFetch(url, { method: 'POST', token });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Action failed');
      }
      showSuccessMessage(`Invitation ${action}ed successfully`);
      fetchInvitations();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Unable to complete the action.');
    }
  };

  const pendingProjectInvites = projectInvites.filter(invite => invite.status === 'Pending');
  const pendingPlotInvites = plotInvites.filter(invite => invite.status === 'Pending');
  const receivedProjectInvites = pendingProjectInvites.filter(invite => invite.invitee?.id === user?.id);
  const sentProjectInvites = pendingProjectInvites.filter(invite => invite.invited_by?.id === user?.id);
  const receivedPlotInvites = pendingPlotInvites.filter(invite => invite.invitee?.id === user?.id);
  const sentPlotInvites = pendingPlotInvites.filter(invite => invite.invited_by?.id === user?.id);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Spinner /></div>;

  return (
    <div className="fade-up" style={{ padding: '0 0 80px' }}>
      <div style={{ marginBottom: '32px' }}>
        <Breadcrumb items={[{ label: 'Notifications', path: '/notifications' }, { label: 'Invitations' }]} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <UserPlus size={34} color="var(--brand-orange)" />
          <div>
            <h1 style={{ fontSize: '56px', margin: 0 }}>Invitations</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '18px', marginTop: '8px' }}>
              Accept, decline, or revoke invitations for your projects and plots.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', padding: '16px', borderRadius: '12px', marginBottom: '24px', maxWidth: '800px' }}>
          {error}
        </div>
      )}

      <InvitationSection
        title="Invitations you received"
        subtitle="Respond to pending project and plot invites."
        invites={[...receivedProjectInvites, ...receivedPlotInvites]}
        onAction={handleAction}
        actionMode="received"
      />

      <InvitationSection
        title="Invitations you sent"
        subtitle="Manage invitations that are still pending."
        invites={[...sentProjectInvites, ...sentPlotInvites]}
        onAction={handleAction}
        actionMode="sent"
      />
    </div>
  );
};

const InvitationSection = ({ title, subtitle, invites, onAction, actionMode }) => {
  return (
    <div style={{ marginBottom: '56px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '28px', margin: 0 }}>{title}</h2>
          <p style={{ fontSize: '15px', color: 'var(--text-tertiary)', marginTop: '8px' }}>{subtitle}</p>
        </div>
      </div>
      <div style={{ background: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-raised)' }}>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Project / Plot</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>From</th>
              <th style={thStyle}>Sent</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invites.length > 0 ? invites.map((invite) => (
              <tr key={`${invite.id}-${invite.plot ?? invite.project}`} style={{ borderBottom: '1px solid var(--border-default)' }}>
                <td style={tdStyle}>{invite.plot ? 'Plot' : 'Project'}</td>
                <td style={tdStyle}>
                  {invite.project_name || invite.plot_address || 'Unknown'}
                </td>
                <td style={tdStyle}>{invite.role}</td>
                <td style={tdStyle}>{invite.invited_by?.display_name || invite.invited_by?.username || 'System'}</td>
                <td style={tdStyle}>{new Date(invite.created_at).toLocaleDateString()}</td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {actionMode === 'received' ? (
                      <>
                        <button onClick={() => onAction({ id: invite.id, kind: invite.plot ? 'plots' : 'projects', action: 'accept' })} className="btn-ghost" style={{ color: 'var(--status-completed)', padding: '9px 16px' }}>
                          <CheckCircle2 size={16} /> Accept
                        </button>
                        <button onClick={() => onAction({ id: invite.id, kind: invite.plot ? 'plots' : 'projects', action: 'decline' })} className="btn-ghost" style={{ color: 'var(--status-delayed)', padding: '9px 16px' }}>
                          <XCircle size={16} /> Decline
                        </button>
                      </>
                    ) : (
                      <button onClick={() => onAction({ id: invite.id, kind: invite.plot ? 'plots' : 'projects', action: 'revoke' })} className="btn-ghost" style={{ color: 'var(--status-delayed)', padding: '9px 16px' }}>
                        Revoke
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  No pending invitations.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const thStyle = {
  padding: '18px 22px',
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--text-tertiary)',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
};

const tdStyle = {
  padding: '18px 22px',
  fontSize: '14px',
  color: 'var(--text-primary)',
  verticalAlign: 'middle',
};

export default InvitationsPage;
