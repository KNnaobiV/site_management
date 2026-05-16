import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Edit2, Plus, FileText, UserPlus, MoreHorizontal, MapPin, Calendar, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList } from '../api/client';
import { Breadcrumb, Tabs, Avatar, Spinner, RoleBadge, InviteModal } from '../components';
import { showSuccessMessage } from '../utils/successMessage';

// ─── Status pill ──────────────────────────────────────────────────────────────
const statusColors = {
  'Planned':    { bg: '#e8e8e8', text: '#555' },
  'In Progress':{ bg: '#fef3ec', text: '#c14a1e' },
  'Completed':  { bg: '#e8f5e9', text: '#2d5a27' },
  'On Hold':    { bg: '#fff3e0', text: '#e65100' },
  'Delayed':    { bg: '#fce4ec', text: '#a32a2a' },
  'Cancelled':  { bg: '#f5f5f5', text: '#9e9e9e' },
};
const StatusPill = ({ status }) => {
  const c = statusColors[status] || statusColors['Planned'];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px', borderRadius: '100px', background: c.bg, color: c.text, fontWeight: 600, fontSize: '13px' }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c.text, flexShrink: 0 }} />
      {status}
    </span>
  );
};

// ─── Form overlay ─────────────────────────────────────────────────────────────
const FormOverlay = ({ children, onClose }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backdropFilter: 'blur(4px)' }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    {children}
  </div>
);

const inputStyle = { width: '100%', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-default)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: '15px', fontFamily: 'var(--font-sans)' };
const labelStyle = { display: 'block', marginBottom: '10px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)', letterSpacing: '0.04em' };

// ─── New Plot Form ─────────────────────────────────────────────────────────────
const NewPlotForm = ({ projectId, token, onSuccess, onClose }) => {
  const [form, setForm] = useState({ address: '', plot_number: '', plot_opening_date: new Date().toISOString().split('T')[0], gps_latitude: '', gps_longitude: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError(null);
    const payload = { address: form.address, plot_opening_date: form.plot_opening_date };
    if (form.plot_number) payload.plot_number = form.plot_number;
    if (form.gps_latitude) payload.gps_latitude = parseFloat(form.gps_latitude);
    if (form.gps_longitude) payload.gps_longitude = parseFloat(form.gps_longitude);
    if (form.notes) payload.notes = form.notes;

    try {
      const res = await apiFetch(`/projects/${projectId}/plots/`, { method: 'POST', token, body: JSON.stringify(payload) });
      if (res.ok) { showSuccessMessage('Plot created ✅'); onSuccess(); onClose(); }
      else { const d = await res.json(); setError(Object.entries(d).map(([k,v]) => `${k}: ${Array.isArray(v)?v.join(', '):v}`).join(' | ')); }
    } catch { setError('Connection error.'); } finally { setSaving(false); }
  };

  return (
    <div className="fade-in" style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '44px', maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}>
      <h2 style={{ fontSize: '32px', marginBottom: '6px' }}>New Plot</h2>
      <p style={{ color: 'var(--text-tertiary)', marginBottom: '32px' }}>Add a new construction plot to this project.</p>
      {error && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', fontSize: '14px' }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={labelStyle}>Address *</label>
          <input type="text" required value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St, City" style={inputStyle} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Plot Number <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
            <input type="text" value={form.plot_number} onChange={e => set('plot_number', e.target.value)} placeholder="e.g. B-12" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Opening Date *</label>
            <input type="date" required value={form.plot_opening_date} onChange={e => set('plot_opening_date', e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>GPS Latitude <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
            <input type="number" step="any" value={form.gps_latitude} onChange={e => set('gps_latitude', e.target.value)} placeholder="e.g. 6.524379" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>GPS Longitude <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
            <input type="number" step="any" value={form.gps_longitude} onChange={e => set('gps_longitude', e.target.value)} placeholder="e.g. 3.379206" style={inputStyle} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Notes <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes about this plot..." style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
            {saving ? 'Creating...' : '+ Create Plot'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const id = projectId; // Alias for backward compatibility if needed
  const { token } = useAuth();
  const location = useLocation();
  console.log("ProjectDetailPage ID:", id);
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [plots, setPlots] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showNewPlot, setShowNewPlot] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => { fetchAll(); }, [id]);

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (tab) setActiveTab(tab);
  }, [location.search]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [projRes, plotsRes, reportsRes] = await Promise.all([
        apiFetch(`/projects/${id}/`, { token }),
        apiFetch(`/projects/${id}/plots/`, { token }),
        apiFetch(`/projects/${id}/reports/`, { token }),
      ]);
      if (projRes.ok) {
        const data = await projRes.json();
        console.log("Project fetch success:", data);
        setProject(data);
      } else {
        console.error("Project fetch failed:", projRes.status, id);
      }
      if (plotsRes.ok) setPlots(unwrapList(await plotsRes.json()));
      if (reportsRes.ok) setReports(unwrapList(await reportsRes.json()));
    } catch (e) { 
      console.error("Fetch error in ProjectDetailPage:", e); 
    } finally { setLoading(false); }
  };

  const fetchReports = async () => {
    try {
      const res = await apiFetch(`/projects/${id}/reports/`, { token });
      if (res.ok) {
        const data = await res.json();
        console.log('Project reports fetch:', data);
        setReports(unwrapList(data));
      } else {
        console.warn('Failed fetching project reports', res.status);
      }
    } catch (e) { console.error('Error fetching project reports', e); }
  };

  useEffect(() => {
    if (activeTab === 'reports') fetchReports();
  }, [activeTab]);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'plots', label: `Plots (${plots.length})` },
    { id: 'team', label: 'Team' },
    { id: 'reports', label: `Reports (${reports.length})` },
  ];

  if (loading) return <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}><Spinner /></div>;
  if (!project) return (
    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
      Project not found (ID: {id})
    </div>
  );

  const pm = project.project_manager;
  const client = project.client;
  const consultants = project.consultants || [];
  const teamMembers = [pm, client, ...consultants].filter(Boolean);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 0 60px' }}>
      {/* Breadcrumb */}
      <Breadcrumb items={[{ label: 'Projects', to: '/projects' }, { label: project.project_name }]} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '12px' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(32px,5vw,56px)', marginBottom: '8px', lineHeight: 1.05 }}>{project.project_name}</h1>
          {project.project_description && (
            <p style={{ color: 'var(--text-secondary)', maxWidth: '640px', fontSize: '16px' }}>{project.project_description}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <StatusPill status={project.project_status} />
          <button className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => navigate(`/projects/${id}/edit`)}>
            <Edit2 size={15} /> Edit
          </button>
          <button className="btn-ghost" onClick={() => navigate('/team/invite')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={15} /> Invite
          </button>
          <button className="btn-primary" onClick={() => navigate(`/projects/${id}/plots/new`)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={15} /> Add Plot
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} style={{ marginBottom: '36px', marginTop: '24px' }} />

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Info cards row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {/* Project Manager */}
            {pm && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '14px' }}>Project Manager</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <Avatar name={pm.display_name || pm.username} size={44} />
                  <div>
                    <p style={{ fontWeight: 700, margin: 0, color: 'var(--text-primary)', fontSize: '17px' }}>{pm.display_name || pm.username}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Project Manager</p>
                  </div>
                </div>
                {pm.email && <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'var(--text-secondary)' }}>✉ {pm.email}</p>}
              </div>
            )}
            {/* Client */}
            {client && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '14px' }}>Client</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <Avatar name={client.display_name || client.username} size={44} />
                  <div>
                    <p style={{ fontWeight: 700, margin: 0, color: 'var(--text-primary)', fontSize: '17px' }}>{client.display_name || client.username}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Client</p>
                  </div>
                </div>
                {client.email && <p style={{ margin: '0 0 4px', fontSize: '13px', color: 'var(--text-secondary)' }}>✉ {client.email}</p>}
              </div>
            )}
            {/* Dates */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '14px' }}>Dates</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <Calendar size={18} color="var(--text-tertiary)" />
                <div>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{project.proposed_start_date || '—'}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Proposed Start</p>
                </div>
              </div>
              {project.proposed_end_date && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Calendar size={18} color="var(--text-tertiary)" />
                  <div>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{project.proposed_end_date}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Target Completion</p>
                  </div>
                </div>
              )}
            </div>
            {/* Plots count */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '14px' }}>Plots</p>
              <p style={{ fontSize: '48px', fontFamily: 'var(--font-serif)', margin: '0 0 4px', color: 'var(--text-primary)', lineHeight: 1 }}>{plots.length}</p>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-tertiary)' }}>of {project.number_of_plots} planned</p>
            </div>
          </div>

          {/* Team Section */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0 }}>Team</p>
              <button className="btn-ghost" onClick={() => setShowInvite(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '6px 14px' }}>
                <Plus size={14} /> Add Member
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
              {teamMembers.map((m, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <Avatar name={m.display_name || m.username} size={48} />
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', maxWidth: '80px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.display_name || m.username}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Plots preview */}
          {plots.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0 }}>Plots</p>
                <button className="btn-ghost" onClick={() => setActiveTab('plots')} style={{ fontSize: '13px', color: 'var(--brand-orange)', borderColor: 'transparent' }}>View all →</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
                {plots.slice(0, 5).map(plot => (
                  <div
                    key={plot.id}
                    onClick={() => navigate(`/plots/${plot.id}`)}
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '18px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-orange)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = 'none'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <MapPin size={14} color="var(--brand-orange)" />
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                        {plot.plot_number ? `Plot ${plot.plot_number}` : 'Plot'}
                      </p>
                    </div>
                    <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{plot.address}</p>
                    <StatusPill status={plot.work_status || 'Planned'} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Plots Tab */}
      {activeTab === 'plots' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
            <button className="btn-primary" onClick={() => setShowNewPlot(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={15} /> Add Plot
            </button>
          </div>
          {plots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-tertiary)' }}>
              <MapPin size={40} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }} />
              <p style={{ fontWeight: 600 }}>No plots yet</p>
              <p style={{ fontSize: '14px' }}>Add the first plot to get started.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {plots.map(plot => (
                <div
                  key={plot.id}
                  onClick={() => navigate(`/plots/${plot.id}`)}
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
                      {plot.plot_number ? `Plot ${plot.plot_number}` : 'Plot'}
                    </p>
                  </div>
                  <p style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={13} /> {plot.address}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <StatusPill status={'Planned'} />
                    {plot.foreman && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Avatar name={plot.foreman.display_name || plot.foreman.username} size={28} />
                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Foreman</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Team Tab */}
      {activeTab === 'team' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
            <button className="btn-primary" onClick={() => setShowInvite(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserPlus size={15} /> Invite Member
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {teamMembers.map((m, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 24px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px' }}>
                <Avatar name={m.display_name || m.username} size={48} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', fontSize: '15px' }}>{m.display_name || m.username}</p>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-tertiary)' }}>{m.email}</p>
                </div>
                <RoleBadge role={i === 0 ? 'project_manager' : i === 1 ? 'client' : 'consultant'} />
              </div>
            ))}
            {teamMembers.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-tertiary)' }}>
                <Users size={40} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }} />
                <p style={{ fontWeight: 600 }}>No team members yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {reports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-tertiary)' }}>
              <FileText size={40} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }} />
              <p style={{ fontWeight: 600 }}>No reports available yet</p>
              <p style={{ fontSize: '14px' }}>Daily reports from work items will appear here once created.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }}>
              {reports.map(report => (
                <div
                  key={report.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/job-items/${report.job_item}?report=${report.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/job-items/${report.job_item}?report=${report.id}`); }}
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '18px', padding: '22px', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '18px', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{report.report_date}</p>
                      <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {report.job_item_name || 'Job report'} • {report.work_item_name || 'Work item'} • {report.construction_plot || project.project_name}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{report.percentage_job_progress}% complete</span>
                      <StatusPill status={report.priority || 'Planned'} />
                    </div>
                  </div>
                  {report.notes && <p style={{ margin: '16px 0 0', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{report.notes}</p>}
                  {report.issues_encountered && <p style={{ margin: '10px 0 0', fontSize: '13px', color: 'var(--status-delayed)' }}>⚠ {report.issues_encountered}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showNewPlot && (
        <FormOverlay onClose={() => setShowNewPlot(false)}>
          <NewPlotForm projectId={id} token={token} onSuccess={fetchAll} onClose={() => setShowNewPlot(false)} />
        </FormOverlay>
      )}

      <InviteModal
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
        type="project"
        entityId={id}
        title="Invite to Project"
      />
    </div>
  );
};

export default ProjectDetailPage;
