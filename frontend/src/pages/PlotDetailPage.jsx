import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Edit2, Plus, FileText, UserPlus, MapPin, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList } from '../api/client';
import { Breadcrumb, Tabs, Avatar, Spinner, ProgressDonut, InviteModal, ChecklistEditor, ImageUploader } from '../components';
import { showSuccessMessage } from '../utils/successMessage';

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

const FormOverlay = ({ children, onClose }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backdropFilter: 'blur(4px)' }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    {children}
  </div>
);

const inputStyle = { width: '100%', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-default)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: '15px', fontFamily: 'var(--font-sans)' };
const labelStyle = { display: 'block', marginBottom: '10px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)', letterSpacing: '0.04em' };

// ─── New Work Item Form ────────────────────────────────────────────────────────
const NewWorkItemForm = ({ projectId, plotId, token, onSuccess, onClose }) => {
  const [form, setForm] = useState({
    name: '', description: '', work_status: 'Planned',
    proposed_start_date: new Date().toISOString().split('T')[0],
    proposed_end_date: '', start_date: '', end_date: '',
  });
  const [checklist, setChecklist] = useState([]);
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError(null);
    const payload = {
      name: form.name,
      description: form.description,
      work_status: form.work_status,
      proposed_start_date: form.proposed_start_date,
      proposed_end_date: form.proposed_end_date,
    };
    if (form.start_date) payload.start_date = form.start_date;
    if (form.end_date) payload.end_date = form.end_date;
    if (checklist.length) payload.checklist = checklist;

    try {
      const res = await apiFetch(`/projects/${projectId}/plots/${plotId}/workitems/`, { method: 'POST', token, body: JSON.stringify(payload) });
      if (res.ok) {
        const wi = await res.json();
        // Upload images if any
        for (const img of images) {
          const fd = new FormData(); fd.append('image', img);
          await apiFetch(`/projects/${projectId}/plots/${plotId}/workitems/${wi.id}/images/`, { method: 'POST', token, body: fd });
        }
        showSuccessMessage('Work item created ✅');
        onSuccess(); onClose();
      } else {
        const d = await res.json(); setError(Object.entries(d).map(([k,v]) => `${k}: ${Array.isArray(v)?v.join(', '):v}`).join(' | '));
      }
    } catch { setError('Connection error.'); } finally { setSaving(false); }
  };

  return (
    <div className="fade-in" style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '44px', maxWidth: '700px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}>
      <h2 style={{ fontSize: '32px', marginBottom: '6px' }}>New Work Item</h2>
      <p style={{ color: 'var(--text-tertiary)', marginBottom: '32px' }}>Define a work phase for this plot.</p>
      {error && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', fontSize: '14px' }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={labelStyle}>Work Item Name *</label>
          <input type="text" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Foundation Work" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe the scope..." style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} />
        </div>
        <div>
          <label style={labelStyle}>Status *</label>
          <select required value={form.work_status} onChange={e => set('work_status', e.target.value)} style={inputStyle}>
            {['Planned','In Progress','Completed','On Hold','Delayed','Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Proposed Start *</label>
            <input type="date" required value={form.proposed_start_date} onChange={e => set('proposed_start_date', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Proposed End *</label>
            <input type="date" required value={form.proposed_end_date} onChange={e => set('proposed_end_date', e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Actual Start <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
            <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Actual End <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
            <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Checklist */}
        <div>
          <label style={{ ...labelStyle, marginBottom: '14px' }}>
            Checklist <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span>
          </label>
          <ChecklistEditor items={checklist} onChange={setChecklist} />
        </div>

        {/* Photos */}
        <ImageUploader files={images} onChange={setImages} label="Photos" max={8} />

        <div style={{ display: 'flex', gap: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
            {saving ? 'Creating...' : '+ Create Work Item'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const PlotDetailPage = () => {
  const { projectId: projectIdFromUrl, plotId } = useParams();
  const id = plotId;
  const [projectId, setProjectId] = useState(projectIdFromUrl);
  const { token } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [plot, setPlot] = useState(null);
  const [workItems, setWorkItems] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showNewWorkItem, setShowNewWorkItem] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [exportScope, setExportScope] = useState('plot');
  const [exportWorkItemId, setExportWorkItemId] = useState('');
  const [exportJobItemId, setExportJobItemId] = useState('');
  const [exportRange, setExportRange] = useState({ from: '', to: '' });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  useEffect(() => { fetchAll(); }, [projectId, id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      // 1. Fetch the plot first (flat path) to get its project ID if needed
      const plotRes = await apiFetch(`/plots/${id}/`, { token });
      if (plotRes.ok) {
        const plotData = await plotRes.json();
        setPlot(plotData);
        const pid = projectIdFromUrl || plotData.construction_project;
        setProjectId(pid);

        // 2. Fetch project and workitems
        const [projRes, wiRes, reportsRes] = await Promise.all([
          apiFetch(`/projects/${pid}/`, { token }),
          apiFetch(`/projects/${pid}/plots/${id}/workitems/`, { token }),
          apiFetch(`/projects/${pid}/plots/${id}/reports/`, { token }),
        ]);
        if (projRes.ok) setProject(await projRes.json());
        if (wiRes.ok) setWorkItems(unwrapList(await wiRes.json()));
        if (reportsRes.ok) setReports(unwrapList(await reportsRes.json()));
      }
    } catch (e) { 
      console.error("PlotDetailPage fetch error:", e); 
    } finally { setLoading(false); }
  };

  const fetchReports = async () => {
    try {
      const res = await apiFetch(`/projects/${projectId}/plots/${id}/reports/`, { token });
      if (res.ok) {
        const data = await res.json();
        console.log('Plot reports fetch:', data);
        setReports(unwrapList(data));
      } else {
        console.warn('Failed fetching plot reports', res.status);
      }
    } catch (e) { console.error('Error fetching plot reports', e); }
  };

  useEffect(() => {
    if (activeTab === 'reports') fetchReports();
  }, [activeTab, projectId]);

  useEffect(() => {
    const now = new Date();
    const weekday = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((weekday + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    setExportRange({
      from: monday.toISOString().slice(0, 10),
      to: sunday.toISOString().slice(0, 10),
    });
  }, []);

  const handleExportReports = async () => {
    setExportError(null);
    setExporting(true);

    try {
      if (!exportRange.from || !exportRange.to) {
        throw new Error('Please set both a start and end date.');
      }

      const params = new URLSearchParams({
        start_date: exportRange.from,
        end_date: exportRange.to,
      });

      if (exportScope === 'workitem' && exportWorkItemId) {
        params.append('work_item_id', exportWorkItemId);
      }
      if (exportScope === 'jobitem' && exportJobItemId) {
        params.append('job_item_id', exportJobItemId);
      }

      const res = await apiFetch(`/plots/${id}/export-reports/?${params.toString()}`, { token });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || 'Unable to export report.');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `plot_${id}_reports_${exportRange.from}_${exportRange.to}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const completedItems = workItems.filter(w => w.work_status === 'Completed').length;
  const reportJobItems = Array.from(new Map(reports.map(r => [r.job_item, { id: r.job_item, name: r.job_item_name }])).values());
  const workItemOptions = workItems.map(wi => ({ id: wi.id, name: wi.name }));
  const progress = workItems.length ? Math.round((completedItems / workItems.length) * 100) : 0;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'workitems', label: `Work Items (${workItems.length})` },
    { id: 'team', label: 'Team' },
    { id: 'reports', label: `Reports (${reports.length})` },
    { id: 'media', label: 'Media' },
  ];

  if (loading) return <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}><Spinner /></div>;
  if (!plot) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Plot not found.</div>;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 0 60px' }}>
      <Breadcrumb items={[
        { label: 'Projects', to: '/projects' },
        { label: project?.project_name || '...', to: `/projects/${projectId}` },
        { label: plot.plot_number ? `Plot ${plot.plot_number}` : plot.address },
      ]} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '12px' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(28px,4vw,48px)', marginBottom: '8px', lineHeight: 1.05 }}>
            {plot.plot_number ? `Plot ${plot.plot_number}` : ''}{plot.plot_number && plot.address ? ' — ' : ''}{plot.address}
          </h1>
          {plot.notes && <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', fontSize: '15px' }}>{plot.notes}</p>}
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => navigate(`/plots/${id}/edit`)}><Edit2 size={15} /> Edit</button>
          <button className="btn-ghost" onClick={() => navigate('/team/invite')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><UserPlus size={15} /> Invite</button>
          <button className="btn-primary" onClick={() => navigate(`/plots/${id}/work-items/new`)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Plus size={15} /> Add Work Item</button>
        </div>
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} style={{ marginBottom: '36px', marginTop: '24px' }} />

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '28px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '24px', alignItems: 'center' }}>
              {/* Address */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <MapPin size={20} color="var(--text-tertiary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 4px' }}>Address</p>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.4 }}>{plot.address}</p>
                  {plot.gps_latitude && <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>{plot.gps_latitude}, {plot.gps_longitude}</p>}
                </div>
              </div>
              {/* Opening Date */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <Clock size={20} color="var(--text-tertiary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 4px' }}>Opened</p>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>{plot.plot_opening_date}</p>
                </div>
              </div>
              {/* Foreman */}
              {plot.foreman && (
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 8px' }}>Foreman</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Avatar name={plot.foreman.display_name || plot.foreman.username} size={36} />
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{plot.foreman.display_name || plot.foreman.username}</p>
                    </div>
                  </div>
                </div>
              )}
              {/* Progress */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0 }}>Progress</p>
                <ProgressDonut percent={progress} size={90} strokeWidth={8} />
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-tertiary)' }}>Overall</p>
              </div>
            </div>
          </div>

          {/* Work Items Preview */}
          {workItems.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0 }}>Work Items</p>
                <button className="btn-ghost" onClick={() => setActiveTab('workitems')} style={{ fontSize: '13px', color: 'var(--brand-orange)', borderColor: 'transparent' }}>View all →</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                {workItems.slice(0, 3).map(wi => (
                  <div
                    key={wi.id}
                    onClick={() => navigate(`/work-items/${wi.id}`)}
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-orange)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = 'none'; }}
                  >
                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>{wi.name}</p>
                    <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{wi.description?.slice(0, 80)}{wi.description?.length > 80 ? '...' : ''}</p>
                    <StatusPill status={wi.work_status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Work Items Tab */}
      {activeTab === 'workitems' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
            <button className="btn-primary" onClick={() => setShowNewWorkItem(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={15} /> Add Work Item
            </button>
          </div>
          {workItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-tertiary)' }}>
              <p style={{ fontWeight: 600 }}>No work items yet</p>
              <p style={{ fontSize: '14px' }}>Add the first work item to begin tracking progress.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {workItems.map(wi => (
                <div
                  key={wi.id}
                  onClick={() => navigate(`/work-items/${wi.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px 24px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-orange)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>{wi.name}</p>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{wi.proposed_start_date} → {wi.proposed_end_date}</p>
                  </div>
                  <StatusPill status={wi.work_status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Team Tab */}
      {activeTab === 'team' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '24px', margin: 0 }}>Team Members</h2>
            <button className="btn-primary" onClick={() => setShowInvite(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserPlus size={15} /> Invite
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {/* Foreman */}
            {plot.foreman && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <Avatar name={plot.foreman.display_name || plot.foreman.username} size={48} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>{plot.foreman.display_name || plot.foreman.username}</p>
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Foreman</p>
                  </div>
                </div>
              </div>
            )}

            {/* Storekeeper */}
            {plot.storekeeper && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <Avatar name={plot.storekeeper.display_name || plot.storekeeper.username} size={48} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>{plot.storekeeper.display_name || plot.storekeeper.username}</p>
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Storekeeper</p>
                  </div>
                </div>
              </div>
            )}

            {/* If no team members */}
            {!plot.foreman && !plot.storekeeper && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                <p style={{ fontWeight: 600 }}>No team members assigned</p>
                <p style={{ fontSize: '14px' }}>Invite team members to get started.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '22px' }}>
            <div style={{ display: 'grid', gap: '18px', gridTemplateColumns: '1fr 1fr', alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>Export scope</label>
                <select
                  value={exportScope}
                  onChange={e => {
                    setExportScope(e.target.value);
                    setExportWorkItemId('');
                    setExportJobItemId('');
                  }}
                  style={inputStyle}
                >
                  <option value="plot">Plot</option>
                  <option value="workitem">Work Item</option>
                  <option value="jobitem">Job Item</option>
                </select>
              </div>
              {exportScope === 'workitem' && (
                <div>
                  <label style={labelStyle}>Work Item</label>
                  <select
                    value={exportWorkItemId}
                    onChange={e => setExportWorkItemId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">All work items</option>
                    {workItemOptions.map(wi => (
                      <option key={wi.id} value={wi.id}>{wi.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {exportScope === 'jobitem' && (
                <div>
                  <label style={labelStyle}>Job Item</label>
                  <select
                    value={exportJobItemId}
                    onChange={e => setExportJobItemId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">All job items</option>
                    {reportJobItems.map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label style={labelStyle}>From</label>
                <input
                  type="date"
                  value={exportRange.from}
                  onChange={e => setExportRange(range => ({ ...range, from: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>To</label>
                <input
                  type="date"
                  value={exportRange.to}
                  onChange={e => setExportRange(range => ({ ...range, to: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', marginTop: '18px' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
                Export all report data for the selected plot, work item, or job item as a PDF.
              </p>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {exportError && <span style={{ color: '#dc2626', fontSize: '13px' }}>{exportError}</span>}
                <button className="btn-primary" onClick={handleExportReports} disabled={exporting} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {exporting ? 'Exporting...' : 'Export PDF'}
                </button>
              </div>
            </div>
          </div>

          {reports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-tertiary)' }}>
              <FileText size={40} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }} />
              <p style={{ fontWeight: 600 }}>No reports for this plot yet</p>
              <p style={{ fontSize: '14px' }}>Daily reports for work items on this plot will appear here.</p>
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
                        {report.job_item_name || 'Job item report'} • {report.work_item_name || 'Work item'}
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

      {activeTab === 'media' && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-tertiary)' }}>
          <p style={{ fontWeight: 600 }}>No media uploaded yet.</p>
        </div>
      )}

      {/* Modals */}
      {showNewWorkItem && (
        <FormOverlay onClose={() => setShowNewWorkItem(false)}>
          <NewWorkItemForm projectId={projectId} plotId={id} token={token} onSuccess={fetchAll} onClose={() => setShowNewWorkItem(false)} />
        </FormOverlay>
      )}

      <InviteModal
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
        type="plot"
        entityId={id}
        projectId={projectId}
        title="Invite to Plot"
      />
    </div>
  );
};

export default PlotDetailPage;
