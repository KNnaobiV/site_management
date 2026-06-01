import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Check, CheckCircle2, Image as ImageIcon, Edit2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList } from '../api/client';
import { Breadcrumb, Tabs, Avatar, Spinner, ProgressDonut, ChecklistEditor, MaterialsEditor, ImageUploader } from '../components';
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
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c.text, flexShrink: 0 }} />{status}
    </span>
  );
};

const FormOverlay = ({ children, onClose }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backdropFilter: 'blur(4px)' }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}>{children}</div>
);

const inputStyle = { width: '100%', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-default)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: '15px', fontFamily: 'var(--font-sans)' };
const labelStyle = { display: 'block', marginBottom: '10px', fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)', letterSpacing: '0.04em' };

const ARTISANS = ['Mason','Plumber','Electrician','Carpenter','Painter','Roofer','Iron Bender','Tiler','Glass Worker','Aluminium Worker','Other'];

// ─── New Job Item Form ─────────────────────────────────────────────────────────
const NewJobItemForm = ({ projectId, plotId, workItemId, token, onSuccess, onClose }) => {
  const [form, setForm] = useState({
    job_name: '', job_description: '', job_artisan: '', job_status: 'Planned',
    priority: 'Medium',
    projected_start_date: new Date().toISOString().split('T')[0],
    projected_end_date: '', actual_start_date: '', actual_end_date: '',
    estimated_hours: '',
  });
  const [materials, setMaterials] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError(null);
    const payload = {
      job_name: form.job_name, job_description: form.job_description,
      job_artisan: form.job_artisan, job_status: form.job_status,
      priority: form.priority,
      projected_start_date: form.projected_start_date,
      projected_end_date: form.projected_end_date,
    };
    if (form.actual_start_date) payload.actual_start_date = form.actual_start_date;
    if (form.actual_end_date) payload.actual_end_date = form.actual_end_date;
    if (form.estimated_hours) payload.estimated_hours = parseFloat(form.estimated_hours);
    if (materials.length) payload.material_requirements = materials;

    try {
      const res = await apiFetch(`/projects/${projectId}/plots/${plotId}/workitems/${workItemId}/jobitems/`, { method: 'POST', token, body: JSON.stringify(payload) });
      if (res.ok) { showSuccessMessage('Job item created ✅'); onSuccess(); onClose(); }
      else { const d = await res.json(); setError(Object.entries(d).map(([k,v]) => `${k}: ${Array.isArray(v)?v.join(', '):v}`).join(' | ')); }
    } catch { setError('Connection error.'); } finally { setSaving(false); }
  };

  return (
    <div className="fade-in" style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '44px', maxWidth: '700px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}>
      <h2 style={{ fontSize: '32px', marginBottom: '6px' }}>New Job Item</h2>
      <p style={{ color: 'var(--text-tertiary)', marginBottom: '32px' }}>Define a specific task for this work item.</p>
      {error && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', fontSize: '14px' }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Job Name *</label>
            <input type="text" required value={form.job_name} onChange={e => set('job_name', e.target.value)} placeholder="e.g. Install Conduit" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Artisan Type *</label>
            <select required value={form.job_artisan} onChange={e => set('job_artisan', e.target.value)} style={inputStyle}>
              <option value="">Select artisan...</option>
              {ARTISANS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Description</label>
          <textarea value={form.job_description} onChange={e => set('job_description', e.target.value)} placeholder="Describe scope of work..." style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }} />
        </div>
        <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Status *</label>
            <select required value={form.job_status} onChange={e => set('job_status', e.target.value)} style={inputStyle}>
              {['Planned','In Progress','Completed','On Hold','Delayed','Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Priority *</label>
            <select required value={form.priority} onChange={e => set('priority', e.target.value)} style={inputStyle}>
              {['Low','Medium','High','Urgent'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Estimated Hours <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
            <input type="number" step="0.5" min="0" value={form.estimated_hours} onChange={e => set('estimated_hours', e.target.value)} placeholder="e.g. 12.5" style={inputStyle} />
          </div>
        </div>
        <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Projected Start *</label>
            <input type="date" required value={form.projected_start_date} onChange={e => set('projected_start_date', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Projected End *</label>
            <input type="date" required value={form.projected_end_date} onChange={e => set('projected_end_date', e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Actual Start <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
            <input type="date" value={form.actual_start_date} onChange={e => set('actual_start_date', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Actual End <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
            <input type="date" value={form.actual_end_date} onChange={e => set('actual_end_date', e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Material Requirements */}
        <div>
          <label style={{ ...labelStyle, marginBottom: '14px' }}>
            Material Requirements <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span>
          </label>
          <MaterialsEditor items={materials} onChange={setMaterials} />
        </div>

        <div style={{ display: 'flex', gap: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
            {saving ? (typeof window !== 'undefined' && window.location.pathname.includes('/edit') ? 'Editing...' : 'Creating...') : (typeof window !== 'undefined' && window.location.pathname.includes('/edit') ? 'Edit' : '+ Create Job Item')}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const WorkItemDetailPage = () => {
  const { projectId: pidFromUrl, plotId: plidFromUrl, workItemId } = useParams();
  const id = workItemId;
  const [projectId, setProjectId] = useState(pidFromUrl);
  const [plotId, setPlotId] = useState(plidFromUrl);
  const { token } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [plot, setPlot] = useState(null);
  const [workItem, setWorkItem] = useState(null);
  const [jobItems, setJobItems] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewJobItem, setShowNewJobItem] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [checklistSaving, setChecklistSaving] = useState(false);

  useEffect(() => { fetchAll(); }, [projectId, plotId, id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const wiRes = await apiFetch(`/workitems/${id}/`, { token });
      if (wiRes.ok) {
        const wiData = await wiRes.json();
        setWorkItem(wiData);
        
        const pid = pidFromUrl || wiData.construction_project;
        const plid = plidFromUrl || wiData.construction_plot;
        setProjectId(pid);
        setPlotId(plid);

        const [projRes, plotRes, jiRes] = await Promise.all([
          apiFetch(`/projects/${pid}/`, { token }),
          apiFetch(`/projects/${pid}/plots/${plid}/`, { token }),
          apiFetch(`/projects/${pid}/plots/${plid}/workitems/${id}/jobitems/`, { token }),
        ]);
        if (projRes.ok) setProject(await projRes.json());
        if (plotRes.ok) setPlot(await plotRes.json());
        if (jiRes.ok) setJobItems(unwrapList(await jiRes.json()));
      }
    } catch (e) { 
      console.error("WorkItemDetailPage fetch error:", e); 
    } finally { setLoading(false); }
  };

  const saveChecklist = async (newChecklist) => {
    setWorkItem(w => ({ ...w, checklist: newChecklist }));
    setChecklistSaving(true);
    try {
      await apiFetch(`/projects/${projectId}/plots/${plotId}/workitems/${id}/`, {
        method: 'PATCH', token,
        body: JSON.stringify({ checklist: newChecklist })
      });
    } catch { /* silent */ } finally { setChecklistSaving(false); }
  };

  const handleApprove = async () => {
    try {
      const res = await apiFetch(`/projects/${projectId}/plots/${plotId}/workitems/${id}/approve/`, {
        method: 'POST',
        token,
      });
      if (res.ok) {
        showSuccessMessage("Work Item approved!");
        fetchAll();
      } else {
        const data = await res.json();
        console.error("Failed to approve work item:", data);
        alert(data.detail || "Failed to approve work item");
      }
    } catch (err) { console.error(err); }
  };

  const uploadImages = async (files) => {
    for (const file of files) {
      const fd = new FormData(); fd.append('image', file);
      await apiFetch(`/projects/${projectId}/plots/${plotId}/workitems/${id}/images/`, { method: 'POST', token, body: fd });
    }
    fetchAll();
  };

  const completedJobs = jobItems.filter(j => j.job_status === 'Completed').length;
  const progress = jobItems.length ? Math.round((completedJobs / jobItems.length) * 100) : 0;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'jobitems', label: `Job Items (${jobItems.length})` },
    { id: 'photos', label: 'Photos' },
  ];

  if (loading) return <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}><Spinner /></div>;
  if (!workItem) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Work item not found.</div>;

  const checklist = workItem.checklist || [];
  const doneCount = checklist.filter(c => c.done).length;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 0 60px' }}>
      <Breadcrumb items={[
        { label: 'Projects', to: '/projects' },
        { label: project?.project_name || '...', to: `/projects/${projectId}` },
        { label: plot?.address || '...', to: `/plots/${plotId}` },
        { label: workItem.name },
      ]} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(26px,4vw,44px)', marginBottom: '10px', lineHeight: 1.05 }}>{workItem.name}</h1>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <StatusPill status={workItem.work_status} />
              {workItem.is_approved && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#edf5ed', color: '#2d5a27', padding: '5px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 600 }}>
                  <CheckCircle2 size={14} /> Approved
                </span>
              )}
            </div>
          </div>
          <ProgressDonut percent={progress} size={100} strokeWidth={9} />
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn-ghost" onClick={() => navigate(`/work-items/${id}/edit`)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit2 size={15} /> Edit Work
          </button>
          {!workItem.is_approved && (
            <button className="btn-ghost" onClick={handleApprove} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2d5a27', borderColor: '#2d5a27' }}>
              <CheckCircle2 size={18} /> Approve Work
            </button>
          )}
          <button className="btn-ghost" onClick={() => { const fi = document.getElementById('wi-img-upload'); fi && fi.click(); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ImageIcon size={15} /> Attach Photos
          </button>
          <input id="wi-img-upload" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => uploadImages(Array.from(e.target.files))} />
          {plot?.role === 'project_manager' && workItem.work_status !== 'Completed' && (
            <button className="btn-primary" onClick={() => navigate(`/work-items/${id}/job-items/new`)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={15} /> Add Job Item
            </button>
          )}
        </div>
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} style={{ marginBottom: '36px', marginTop: '24px' }} />

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Description */}
            {workItem.description && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 12px' }}>Description</p>
                <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--text-secondary)', fontSize: '15px' }}>{workItem.description}</p>
              </div>
            )}

            {/* Dates */}
            <div className="mobile-grid-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 6px' }}>Start Date</p>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{workItem.proposed_start_date}</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 6px' }}>Target End</p>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{workItem.proposed_end_date}</p>
              </div>
            </div>

            {/* Checklist */}
            {checklist.length > 0 && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0 }}>
                    Checklist {checklistSaving ? '(saving…)' : `${doneCount}/${checklist.length}`}
                  </p>
                  <div style={{ height: '4px', flex: 1, maxWidth: '100px', background: 'var(--bg-raised)', borderRadius: '4px', marginLeft: '12px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${checklist.length ? (doneCount/checklist.length)*100 : 0}%`, background: 'var(--brand-orange)', borderRadius: '4px', transition: 'width 0.3s' }} />
                  </div>
                </div>
                <ChecklistEditor items={checklist} onChange={saveChecklist} />
              </div>
            )}
          </div>

          {/* Job Items sidebar preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0 }}>Job Items ({jobItems.length})</p>
              <button onClick={() => setActiveTab('jobitems')} style={{ background: 'none', border: 'none', fontSize: '13px', color: 'var(--brand-orange)', cursor: 'pointer' }}>View all →</button>
            </div>
            {jobItems.slice(0, 4).map(ji => (
              <div
                key={ji.id}
                onClick={() => navigate(`/job-items/${ji.id}`)}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '16px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-orange)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
              >
                <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{ji.job_name}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{ji.job_artisan}</span>
                  <StatusPill status={ji.job_status} />
                </div>
              </div>
            ))}
            {plot?.role === 'project_manager' && workItem.work_status !== 'Completed' && (
              <button className="btn-ghost" onClick={() => setShowNewJobItem(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px' }}>
                <Plus size={14} /> Add Job Item
              </button>
            )}
          </div>
        </div>
      )}

      {/* Job Items Tab */}
      {activeTab === 'jobitems' && (
        <div>
          {jobItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-tertiary)' }}>
              <p style={{ fontWeight: 600 }}>No job items yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {jobItems.map(ji => (
                <div
                  key={ji.id}
                  onClick={() => navigate(`/job-items/${ji.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '18px 22px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-orange)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 3px', fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>{ji.job_name}</p>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-tertiary)' }}>{ji.job_artisan} · {ji.projected_start_date} → {ji.projected_end_date}</p>
                  </div>
                  {ji.estimated_hours && <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>{ji.estimated_hours}h</span>}
                  <StatusPill status={ji.job_status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Photos Tab */}
      {activeTab === 'photos' && (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <ImageUploader
              files={[]}
              onChange={uploadImages}
              label="Upload Photos"
              max={20}
            />
          </div>
          {workItem.images?.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: '10px' }}>
              {workItem.images.map(img => (
                <img key={img.id} src={img.image} alt={img.caption || ''} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '12px', border: '1px solid var(--border-subtle)' }} />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>No photos yet.</div>
          )}
        </div>
      )}

      {/* Modal */}
      {showNewJobItem && (
        <FormOverlay onClose={() => setShowNewJobItem(false)}>
          <NewJobItemForm projectId={projectId} plotId={plotId} workItemId={id} token={token} onSuccess={fetchAll} onClose={() => setShowNewJobItem(false)} />
        </FormOverlay>
      )}
    </div>
  );
};

export default WorkItemDetailPage;
