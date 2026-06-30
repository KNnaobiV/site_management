import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Breadcrumb, Spinner, Avatar, SearchableSelect } from '../components';
import { Briefcase, Hammer, Eye, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList } from '../api/client';
import { showSuccessMessage } from '../utils/successMessage';

const InviteTeamMemberPage = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialProjectId = searchParams.get('project');
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [projects, setProjects] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    invitee_id: '',
    role: 'project_manager',
    assigned_projects: initialProjectId ? [parseInt(initialProjectId)] : [],
    message: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [projRes, invRes] = await Promise.all([
        apiFetch('/projects/', { token }),
        apiFetch('/invitations/projects/', { token })
      ]);

      if (projRes.ok) {
        const allProjs = unwrapList(await projRes.json());
        const filtered = allProjs.filter(p => p.created_by?.id === user?.id || p.project_manager?.id === user?.id);
        setProjects(filtered);
      }
      if (invRes.ok) setPendingInvites(unwrapList(await invRes.json()));
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setFetchingData(false);
    }
  };

  const handleUserSearch = async (q) => {
    if (q.length < 2) return;
    try {
      const res = await apiFetch(`/auth/users/search/?q=${q}`, { token });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.map(u => ({ id: u.id, label: `${u.display_name || u.username} (${u.email})`, avatar: u.profile_picture })));
      }
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.invitee_id) { setError("Please select a user to invite."); return; }
    if (formData.assigned_projects.length === 0) { setError("Please select at least one project."); return; }

    setLoading(true);
    setError(null);

    try {
      let successCount = 0;
      for (const pId of formData.assigned_projects) {
        const res = await apiFetch(`/projects/${pId}/invite/`, {
          method: 'POST',
          token,
          body: JSON.stringify({
            invitee_id: formData.invitee_id,
            role: formData.role,
            message: formData.message
          })
        });
        if (res.ok) successCount++;
      }

      if (successCount > 0) {
        showSuccessMessage(`Sent ${successCount} invitation(s) ✅`);
        setFormData({ ...formData, invitee_id: '', assigned_projects: [], message: '' });
        fetchData();
      } else {
        setError("Failed to send invitations.");
      }
    } catch (err) {
      setError("Connection error.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm("Revoke this invitation?")) return;
    try {
      const res = await apiFetch(`/invitations/projects/${id}/revoke/`, { method: 'POST', token });
      if (res.ok) {
        showSuccessMessage("Invitation revoked");
        fetchData();
      }
    } catch (err) { console.error(err); }
  };

  const roles = [
    { id: 'project_manager', label: 'Project Manager', sub: 'Oversees the project and manages teams.', icon: <Briefcase size={24} /> },
    { id: 'client', label: 'Client', sub: 'Project owner with full visibility.', icon: <Eye size={24} /> },
    { id: 'consultant', label: 'Consultant', sub: 'Technical expert or specialist.', icon: <Hammer size={24} /> },
  ];

  if (fetchingData) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Spinner /></div>;

  return (
    <div className="fade-up" style={{ padding: '0 0 80px' }}>
      <div style={{ marginBottom: '32px' }}>
        <Breadcrumb items={[{ label: 'Team', path: '/team' }, { label: 'Invite' }]} />
        <h1 style={{ fontSize: '64px', marginTop: '12px' }}>Invite Team Member</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '18px' }}>Send an invitation to join your projects.</p>
      </div>

      {error && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>{error}</div>}

      <form onSubmit={handleSubmit} style={{
        background: 'var(--bg-card)',
        borderRadius: '24px',
        border: '1px solid var(--border-default)',
        padding: '48px',
        maxWidth: '1200px'
      }}>
        <div style={{ marginBottom: '32px' }}>
          <label style={labelStyle}>Search User (Name or Email)</label>
          <SearchableSelect
            placeholder="Search for an existing user..."
            options={searchResults}
            value={formData.invitee_id}
            onChange={val => setFormData({ ...formData, invitee_id: val })}
            onSearch={handleUserSearch}
          />
        </div>

        <div style={{ marginBottom: '32px' }}>
          <label style={labelStyle}>Role</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {roles.map(r => (
              <div
                key={r.id}
                onClick={() => setFormData({ ...formData, role: r.id })}
                style={{
                  padding: '24px',
                  borderRadius: '16px',
                  border: `2px solid ${formData.role === r.id ? 'var(--brand-orange)' : 'var(--border-default)'}`,
                  background: 'var(--bg-raised)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  position: 'relative'
                }}
              >
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--border-strong)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: formData.role === r.id ? 'var(--brand-orange)' : 'transparent',
                  borderColor: formData.role === r.id ? 'var(--brand-orange)' : 'var(--border-strong)'
                }}>
                  {formData.role === r.id && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />}
                </div>
                <div style={{ color: formData.role === r.id ? 'var(--brand-orange)' : 'var(--text-secondary)' }}>{r.icon}</div>
                <div>
                  <h4 style={{ fontSize: '18px', margin: 0 }}>{r.label}</h4>
                  <p style={{ fontSize: '13px', margin: '4px 0 0', lineHeight: 1.4 }}>{r.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <label style={labelStyle}>Assign to Projects</label>
          <div style={{ ...inputStyle, display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: '56px' }}>
            {formData.assigned_projects.map(pId => {
              const p = projects.find(proj => proj.id === pId);
              return (
                <div key={pId} style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  {p?.project_name || `Project ${pId}`}
                  {!initialProjectId && (
                    <X size={14} style={{ cursor: 'pointer' }} onClick={() => setFormData({ ...formData, assigned_projects: formData.assigned_projects.filter(id => id !== pId) })} />
                  )}
                </div>
              );
            })}
            {!initialProjectId && (
              <select
                style={{ background: 'transparent', border: 'none', outline: 'none', flex: 1, fontSize: '14px' }}
                onChange={e => {
                  if (e.target.value && !formData.assigned_projects.includes(parseInt(e.target.value))) {
                    setFormData({ ...formData, assigned_projects: [...formData.assigned_projects, parseInt(e.target.value)] });
                  }
                  e.target.value = '';
                }}
              >
                <option value="">Add project...</option>
                {projects.filter(p => !formData.assigned_projects.includes(p.id)).map(p => (
                  <option key={p.id} value={p.id}>{p.project_name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Personal Message <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(optional)</span></label>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{formData.message.length}/500</span>
          </div>
          <textarea
            placeholder="Add a personal message to your invitation..."
            maxLength={500}
            value={formData.message}
            onChange={e => setFormData({ ...formData, message: e.target.value })}
            style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-default)', paddingTop: '32px' }}>
          <button type="button" onClick={() => navigate(-1)} className="btn-ghost" style={{ padding: '12px 32px' }}>Cancel</button>
          <button type="submit" className="btn-primary" style={{ padding: '12px 48px' }} disabled={loading}>
            {loading ? <Spinner size={20} /> : 'Send Invitation'}
          </button>
        </div>
      </form>

      {/* Pending Invitations Table */}
      <div style={{ marginTop: '64px' }}>
        <h3 style={{ marginBottom: '24px' }}>Pending Invitations ({pendingInvites.length})</h3>
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-default)',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-raised)' }}>
                <th style={thStyle}>EMAIL</th>
                <th style={thStyle}>PROJECT</th>
                <th style={thStyle}>ROLE</th>
                <th style={thStyle}>SENT</th>
                <th style={thStyle}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {pendingInvites.map((invite, i) => (
                <tr key={i} style={{ borderBottom: i === pendingInvites.length - 1 ? 'none' : '1px solid var(--border-default)' }}>
                  <td style={tdStyle}>{invite.invitee?.email || invite.email}</td>
                  <td style={tdStyle}>{invite.project_name || invite.project?.project_name}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Avatar size={24} name={invite.role} />
                      {invite.role}
                    </div>
                  </td>
                  <td style={tdStyle}>{new Date(invite.created_at).toLocaleDateString()}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <button onClick={() => handleRevoke(invite.id)} style={{ background: 'none', color: 'var(--status-delayed)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Revoke</button>
                    </div>
                  </td>
                </tr>
              ))}
              {pendingInvites.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No pending invitations</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
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
  background: 'var(--bg-raised)',
  color: 'var(--text-primary)',
  fontSize: '15px',
  outline: 'none',
  transition: 'border-color 0.2s'
};

const thStyle = {
  padding: '16px 24px',
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--text-tertiary)',
  letterSpacing: '0.05em'
};

const tdStyle = {
  padding: '20px 24px',
  fontSize: '14px',
  color: 'var(--text-primary)'
};

export default InviteTeamMemberPage;
