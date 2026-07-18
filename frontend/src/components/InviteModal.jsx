import React, { useState, useEffect, useRef } from 'react';
import { X, Search, UserPlus, Loader, HardHat, Package } from 'lucide-react';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';

/**
 * InviteModal — searchable user invite form for Projects and Plots.
 * @param {boolean} isOpen
 * @param {function} onClose
 * @param {function} onSuccess - optional callback after a successful invite
 * @param {string} type - 'project' | 'plot'
 * @param {string} entityId - project or plot ID
 * @param {string} projectId - parent project ID (required for plot invites)
 * @param {string} title - modal title
 * @param {string} defaultRole - if set, pre-selects and locks the role so the user doesn't need to choose
 */
const InviteModal = ({ isOpen, onClose, onSuccess, type = 'project', entityId, projectId, title, defaultRole }) => {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [role, setRole] = useState(defaultRole || '');
  const [message, setMessage] = useState('');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const debounceRef = useRef(null);

  const projectRoles = [
    { value: 'project_manager', label: 'Project Manager' },
    { value: 'client', label: 'Client' },
    { value: 'consultant', label: 'Consultant' },
  ];

  const plotRoles = [
    { value: 'foreman', label: 'Foreman' },
    { value: 'storekeeper', label: 'Storekeeper' },
  ];

  const roles = type === 'plot' ? plotRoles : projectRoles;

  const roleIcons = {
    foreman: <HardHat size={16} />,
    storekeeper: <Package size={16} />,
  };

  const roleLabels = {
    foreman: 'Foreman',
    storekeeper: 'Storekeeper',
    project_manager: 'Project Manager',
    client: 'Client',
    consultant: 'Consultant',
  };

  useEffect(() => {
    if (!query || query.length < 2) { setSearchResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiFetch(`/auth/users/search/?q=${encodeURIComponent(query)}`, { token });
        if (res.ok) setSearchResults(await res.json());
      } catch { /* ignore */ } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    if (!isOpen) {
      setQuery(''); setSelectedUser(null);
      setRole(defaultRole || '');
      setMessage(''); setError(null); setSuccess(false); setSearchResults([]);
    }
  }, [isOpen, defaultRole]);

  // Keep role in sync if defaultRole prop changes while open
  useEffect(() => {
    if (defaultRole) setRole(defaultRole);
  }, [defaultRole]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser || !role) { setError('Please select a user and role.'); return; }
    setSubmitting(true); setError(null);

    const url = type === 'plot'
      ? `/projects/${projectId}/plots/${entityId}/invite/`
      : `/projects/${entityId}/invite/`;

    try {
      const res = await apiFetch(url, {
        method: 'POST',
        token,
        body: JSON.stringify({ invitee_id: selectedUser.id, role, message }),
      });
      if (res.ok) {
        setSuccess(true);
        if (onSuccess) onSuccess();
        setTimeout(onClose, 1500);
      } else {
        const data = await res.json();
        setError(data.detail || JSON.stringify(data));
      }
    } catch { setError('Connection error.'); } finally { setSubmitting(false); }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      padding: '24px'
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="fade-in" style={{
        background: 'var(--bg-card)', borderRadius: '24px',
        border: '1px solid var(--border-subtle)',
        padding: '40px', width: '100%', maxWidth: '520px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.12)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <UserPlus size={20} color="var(--brand-orange)" />
              <h2 style={{ fontSize: '22px', margin: 0 }}>{title || 'Invite Member'}</h2>
            </div>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-tertiary)' }}>
              Send an invitation to join this {type}.
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '8px', color: 'var(--text-tertiary)' }}>
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>✅</div>
            <p style={{ color: 'var(--status-completed)', fontWeight: 600, fontSize: '16px' }}>Invitation sent!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {error && (
              <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', padding: '12px 16px', borderRadius: '12px', fontSize: '14px' }}>
                {error}
              </div>
            )}

            {/* User search */}
            <div>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 600, fontSize: '14px' }}>Search User *</label>
              {selectedUser ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', border: '2px solid var(--brand-orange)', background: 'var(--brand-orange-subtle)' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--brand-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                    {(selectedUser.display_name || selectedUser.username || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{selectedUser.display_name || selectedUser.username}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>{selectedUser.email}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={16} /></button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    {searching
                      ? <Loader size={16} color="var(--text-tertiary)" style={{ animation: 'spin 1s linear infinite' }} />
                      : <Search size={16} color="var(--text-tertiary)" />
                    }
                  </div>
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search by name or email..."
                    style={{ width: '100%', padding: '14px 14px 14px 42px', borderRadius: '12px', border: '1px solid var(--border-default)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: '15px' }}
                  />
                  {searchResults.length > 0 && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '14px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100, overflow: 'hidden' }}>
                      {searchResults.map(u => (
                        <div
                          key={u.id}
                          onClick={() => { setSelectedUser(u); setQuery(''); setSearchResults([]); }}
                          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-raised)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--brand-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>
                            {(u.display_name || u.username || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{u.display_name || u.username}</p>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>{u.email}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Role — locked pill badge when defaultRole is set, otherwise a dropdown */}
            <div>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 600, fontSize: '14px' }}>Role</label>
              {defaultRole ? (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '10px 18px', borderRadius: '100px',
                  background: 'var(--brand-orange-subtle)',
                  border: '1px solid var(--brand-orange)',
                  color: 'var(--brand-orange)', fontWeight: 600, fontSize: '14px'
                }}>
                  {roleIcons[defaultRole]}
                  {roleLabels[defaultRole] || defaultRole}
                </div>
              ) : (
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  required
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border-default)', background: 'var(--bg-raised)', color: role ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: '15px' }}
                >
                  <option value="">Select a role...</option>
                  {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              )}
            </div>

            {/* Message */}
            <div>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 600, fontSize: '14px' }}>Message <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(optional)</span></label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Add a personal message..."
                style={{ width: '100%', minHeight: '90px', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border-default)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: '15px', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
              <button type="button" onClick={onClose} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
                {submitting ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default InviteModal;
