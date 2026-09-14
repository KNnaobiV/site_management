import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Check, CheckCircle2, Image as ImageIcon, Edit2, X, Trash2, DollarSign, ArrowRight, Download, FileText, BarChart3, HelpCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList, formatApiError, getMediaUrl } from '../api/client';
import { Breadcrumb, Tabs, Avatar, Spinner, ProgressDonut, MaterialsEditor, ImageUploader, Modal } from '../components';
import BudgetModal from '../components/BudgetModal';
import ExpensesTable from '../components/ExpensesTable';
import { showSuccessMessage } from '../utils/successMessage';

const statusColors = {
  'Planned': { bg: '#e8e8e8', text: '#555' },
  'In Progress': { bg: '#fef3ec', text: '#c14a1e' },
  'Completed': { bg: '#e8f5e9', text: '#2d5a27' },
  'On Hold': { bg: '#fff3e0', text: '#e65100' },
  'Delayed': { bg: '#fce4ec', text: '#a32a2a' },
  'Cancelled': { bg: '#f5f5f5', text: '#9e9e9e' },
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

const ARTISANS = ['Mason', 'Plumber', 'Electrician', 'Carpenter', 'Painter', 'Roofer', 'Iron Bender', 'Tiler', 'Glass Worker', 'Aluminium Worker', 'Other'];

// ─── New Job Item Form ─────────────────────────────────────────────────────────
const NewJobItemForm = ({ projectId, plotId, workItemId, token, onSuccess, onClose }) => {
  const [form, setForm] = useState({
    job_name: '', job_description: '', job_artisan: '', job_status: 'Planned',
    priority: 'Medium',
    start_date: new Date().toISOString().split('T')[0],
    target_end_date: '',
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
      start_date: form.start_date,
      target_end_date: form.target_end_date,
    };
    if (form.actual_start_date) payload.actual_start_date = form.actual_start_date;
    if (form.actual_end_date) payload.actual_end_date = form.actual_end_date;
    if (form.estimated_hours) payload.estimated_hours = parseFloat(form.estimated_hours);
    if (materials.length) payload.material_requirements = materials;

    try {
      const res = await apiFetch(`/projects/${projectId}/plots/${plotId}/workitems/${workItemId}/jobitems/`, { method: 'POST', token, body: JSON.stringify(payload) });
      if (res.ok) { showSuccessMessage('Job created ✅'); onSuccess(); onClose(); }
      else { const d = await res.json(); setError(formatApiError(d)); }
    } catch { setError('Connection error.'); } finally { setSaving(false); }
  };

  return (
    <div className="fade-in" style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '44px', maxWidth: '700px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}>
      <h2 style={{ fontSize: '32px', marginBottom: '6px' }}>New Job</h2>
      <p style={{ color: 'var(--text-tertiary)', marginBottom: '32px' }}>Define a specific task for this work.</p>
      {error && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', fontSize: '14px' }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Job Name <span style={{ color: "var(--brand-orange)" }}>*</span></label>
            <input type="text" required value={form.job_name} onChange={e => set('job_name', e.target.value)} placeholder="e.g. Install Conduit" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Artisan Type <span style={{ color: "var(--brand-orange)" }}>*</span></label>
            <select required value={form.job_artisan} onChange={e => set('job_artisan', e.target.value)} style={inputStyle}>
              <option value="">Select artisan...</option>
              {ARTISANS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Description <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
          <textarea value={form.job_description} onChange={e => set('job_description', e.target.value)} placeholder="Describe scope of work..." style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }} />
        </div>
        <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Status <span style={{ color: "var(--brand-orange)" }}>*</span></label>
            <select required value={form.job_status} onChange={e => set('job_status', e.target.value)} style={inputStyle}>
              {['Planned', 'In Progress', 'Completed', 'On Hold', 'Delayed', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Priority <span style={{ color: "var(--brand-orange)" }}>*</span></label>
            <select required value={form.priority} onChange={e => set('priority', e.target.value)} style={inputStyle}>
              {['Low', 'Medium', 'High', 'Urgent'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Estimated Hours <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
            <input type="number" step="0.5" min="0" value={form.estimated_hours} onChange={e => set('estimated_hours', e.target.value)} placeholder="e.g. 12.5" style={inputStyle} />
          </div>
        </div>
        <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Start Date <span style={{ color: "var(--brand-orange)" }}>*</span></label>
            <input type="date" required value={form.start_date} onChange={e => set('start_date', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Target End Date <span style={{ color: "var(--brand-orange)" }}>*</span></label>
            <input type="date" required value={form.target_end_date} onChange={e => set('target_end_date', e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Actual Start <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
            <input type="date" value={form.actual_start_date} onChange={e => set('actual_start_date', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Actual End <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
            <input type="date" value={form.actual_end_date} onChange={e => set('actual_end_date', e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Material Requirements */}
        <div>
          <label style={{ ...labelStyle, marginBottom: '14px' }}>Material Requirements <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
          <MaterialsEditor items={materials} onChange={setMaterials} />
        </div>

        <div style={{ display: 'flex', gap: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
            {saving ? (typeof window !== 'undefined' && window.location.pathname.includes('/edit') ? 'Editing...' : 'Creating...') : (typeof window !== 'undefined' && window.location.pathname.includes('/edit') ? 'Edit' : '+ Create Job')}
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Attach Photos Modal ───────────────────────────────────────────────────────
const AttachPhotosModal = ({ projectId, plotId, workItemId, token, onSuccess, onClose }) => {
  const [stagedFiles, setStagedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpload = async (filesToUpload = stagedFiles) => {
    if (!filesToUpload || filesToUpload.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of filesToUpload) {
        const fd = new FormData();
        fd.append('image', file);
        const res = await apiFetch(`/projects/${projectId}/plots/${plotId}/workitems/${workItemId}/images/`, {
          method: 'POST',
          token,
          body: fd,
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(formatApiError(errData, 'Failed to upload photo'));
        }
      }
      showSuccessMessage(`Photo${filesToUpload.length > 1 ? 's' : ''} added successfully ✅`);
      setStagedFiles([]);
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error saving photos');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fade-in" style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '36px', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <h2 style={{ fontSize: '24px', margin: 0 }}>Attach Photos</h2>
        <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
          <X size={20} />
        </button>
      </div>
      <p style={{ color: 'var(--text-tertiary)', marginBottom: '24px', fontSize: '14px' }}>Select pictures from your gallery to attach to this work.</p>

      {error && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', fontSize: '14px' }}>{error}</div>}

      <ImageUploader
        files={stagedFiles}
        onChange={setStagedFiles}
        label="Select Photos"
        max={10}
        onUpload={handleUpload}
        uploading={uploading}
        uploadButtonText="Upload"
      />

      <div style={{ display: 'flex', gap: '12px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)', marginTop: '24px' }}>
        <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Close</button>
      </div>
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
  const [expenses, setExpenses] = useState([]);
  const [budget, setBudget] = useState(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [images, setImages] = useState([]);
  const [stagedPhotos, setStagedPhotos] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewJobItem, setShowNewJobItem] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showJobHelp, setShowJobHelp] = useState(false);

  useEffect(() => { fetchAll(); }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const wiRes = await apiFetch(`/workitems/${id}/`, { token });
      if (wiRes.ok) {
        const wiData = await wiRes.json();
        setWorkItem(wiData);
        setBudget(wiData.budget || null);

        const pid = pidFromUrl || wiData.construction_project;
        const plid = plidFromUrl || wiData.construction_plot;
        setProjectId(pid);
        setPlotId(plid);

        const [projRes, plotRes, jiRes, expRes, bRes] = await Promise.all([
          pid ? apiFetch(`/projects/${pid}/`, { token }) : Promise.resolve(null),
          (pid && plid) ? apiFetch(`/projects/${pid}/plots/${plid}/`, { token }) : Promise.resolve(null),
          apiFetch(`/workitems/${id}/jobitems/`, { token }).then(r => r.ok ? r : (pid && plid ? apiFetch(`/projects/${pid}/plots/${plid}/workitems/${id}/jobitems/`, { token }) : r)),
          apiFetch(`/workitems/${id}/expenses/`, { token }),
          apiFetch(`/workitems/${id}/budget/`, { token }),
        ]);
        if (projRes && projRes.ok) setProject(await projRes.json());
        if (plotRes && plotRes.ok) setPlot(await plotRes.json());
        if (jiRes && jiRes.ok) setJobItems(unwrapList(await jiRes.json()));
        if (expRes && expRes.ok) setExpenses(unwrapList(await expRes.json()));
        if (bRes && bRes.ok) setBudget(await bRes.json());
      }
    } catch (e) {
      console.error("WorkItemDetailPage fetch error:", e);
    } finally { setLoading(false); }
  };

  const fetchExpenses = async () => {
    try {
      const expRes = await apiFetch(`/workitems/${id}/expenses/`, { token });
      if (expRes.ok) setExpenses(unwrapList(await expRes.json()));
      const bRes = await apiFetch(`/workitems/${id}/budget/`, { token });
      if (bRes.ok) setBudget(await bRes.json());
      const wiRes = await apiFetch(`/workitems/${id}/`, { token });
      if (wiRes.ok) setWorkItem(await wiRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleApprove = async () => {
    try {
      const res = await apiFetch(`/projects/${projectId}/plots/${plotId}/workitems/${id}/approve/`, {
        method: 'POST',
        token,
      });
      if (res.ok) {
        showSuccessMessage("Work approved!");
        fetchAll();
      } else {
        const data = await res.json();
        console.error("Failed to approve work:", data);
        alert(data.detail || "Failed to approve work");
      }
    } catch (err) { console.error(err); }
  };

  const handleMarkComplete = async () => {
    try {
      const url = projectId && plotId
        ? `/projects/${projectId}/plots/${plotId}/workitems/${id}/`
        : `/workitems/${id}/`;
      const res = await apiFetch(url, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ work_status: 'Completed' }),
      });
      if (res.ok) {
        showSuccessMessage("Work marked as completed!");
        fetchAll();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(formatApiError(data, "Failed to complete work"));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSavePhotos = async (filesToUpload = stagedPhotos) => {
    if (!filesToUpload || filesToUpload.length === 0) return;
    setUploadingPhotos(true);
    try {
      for (const file of filesToUpload) {
        const fd = new FormData();
        fd.append('image', file);
        const res = await apiFetch(`/projects/${projectId}/plots/${plotId}/workitems/${id}/images/`, {
          method: 'POST',
          token,
          body: fd,
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(formatApiError(errData, 'Failed to upload photo'));
        }
      }
      showSuccessMessage(`Photo${filesToUpload.length > 1 ? 's' : ''} added successfully ✅`);
      setStagedPhotos([]);
      fetchAll();
    } catch (err) {
      console.error('Failed to upload photos:', err);
      alert(err.message || 'Error uploading photos');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!window.confirm("Are you sure you want to delete this photo?")) return;
    try {
      const url = projectId && plotId
        ? `/projects/${projectId}/plots/${plotId}/workitems/${id}/images/${photoId}/`
        : `/workitems/${id}/images/${photoId}/`;
      const res = await apiFetch(url, {
        method: 'DELETE',
        token,
      });
      if (res.ok) {
        showSuccessMessage("Photo deleted successfully ✅");
        fetchAll();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(formatApiError(errData, "Failed to delete photo"));
      }
    } catch (err) {
      console.error('Failed to delete photo:', err);
      alert("Error deleting photo");
    }
  };

  const formatCurrency = (amount, currency = 'NGN') => {
    try {
      const locale = currency === 'USD' ? 'en-US' : currency === 'GBP' ? 'en-GB' : 'en-NG';
      return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(amount));
    } catch {
      return `${currency} ${Number(amount).toLocaleString()}`;
    }
  };

  const completedJobs = jobItems.filter(j => j.job_status === 'Completed').length;
  const progress = workItem?.progress !== undefined
    ? workItem.progress
    : (jobItems.length ? Math.round((completedJobs / jobItems.length) * 100) : 0);

  const activeBudget = budget || workItem?.budget || null;
  const totalSpent = parseFloat(activeBudget?.spent_amount ?? workItem?.spent_amount ?? 0);
  const budgetCurrency = activeBudget?.currency || 'NGN';
  const hasBudget = activeBudget && parseFloat(activeBudget.allocated_amount) > 0;
  const percentageSpent = hasBudget ? Math.round((totalSpent / parseFloat(activeBudget.allocated_amount)) * 100) : null;
  const isOverBudget = hasBudget && totalSpent > parseFloat(activeBudget.allocated_amount);

  const canViewFinance =
    plot?.role === 'owner' ||
    plot?.role === 'project_manager' ||
    plot?.role === 'foreman' ||
    project?.role === 'owner' ||
    project?.role === 'project_manager';

  const canManageBudget = canViewFinance;

  const [exportingFinancial, setExportingFinancial] = useState(false);
  const [financialExportError, setFinancialExportError] = useState(null);

  const handleExportFinancialReport = async () => {
    setExportingFinancial(true);
    setFinancialExportError(null);
    try {
      const res = await apiFetch(`/workitems/${id}/export-financial-report/`, { token });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || 'Unable to export financial report.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `workitem_${id}_financial_report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setFinancialExportError(err.message || 'Financial report export failed.');
    } finally {
      setExportingFinancial(false);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'jobitems', label: `Jobs (${jobItems.length})` },
    ...(canViewFinance ? [
      { id: 'finance', label: 'Finance' },
      { id: 'reports', label: 'Reports' },
    ] : []),
    { id: 'photos', label: 'Photos' },
  ];

  if (loading) return <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}><Spinner /></div>;
  if (!workItem) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Work not found.</div>;

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
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {(plot?.role === 'owner' || plot?.role === 'project_manager') && (
            <button className="btn-ghost" onClick={() => navigate(`/work-items/${id}/edit`)}>
              <Edit2 size={16} /> Edit
            </button>
          )}
          {(plot?.role === 'owner' || plot?.role === 'project_manager' || project?.role === 'owner' || project?.role === 'project_manager') && !workItem.is_approved && (
            <button className="btn-ghost" onClick={handleApprove}>
              <CheckCircle2 size={16} /> Approve Work
            </button>
          )}
          {canManageBudget && (
            <button className="btn-ghost" onClick={() => setShowBudgetModal(true)}>
              <DollarSign size={16} /> {hasBudget ? 'Edit Budget' : 'Set Budget'}
            </button>
          )}
          {workItem.work_status !== 'Completed' && (
            <button className="btn-ghost" onClick={handleMarkComplete}>
              <CheckCircle2 size={16} /> Mark Complete
            </button>
          )}
          <button className="btn-ghost" onClick={() => setShowAttachModal(true)}>
            <ImageIcon size={16} /> Attach Photos
          </button>
          {(plot?.role === 'owner' || plot?.role === 'project_manager' || plot?.role === 'foreman') && workItem.work_status !== 'Completed' && (
            <button className="btn-primary" onClick={() => navigate(`/work-items/${id}/job-items/new`)}>
              <Plus size={16} /> Add Job
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
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Start Date</p>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{workItem.start_date}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Target End Date</p>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{workItem.target_end_date}</p>
              </div>
            </div>

            {/* Budget & Expenses Summary */}
            {canViewFinance && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0 }}>Expenses & Budget</p>
                  {hasBudget ? (
                    <span style={{ fontSize: '12px', fontWeight: 600, color: isOverBudget ? '#dc2626' : '#16a34a' }}>
                      {isOverBudget ? `Over Budget (${percentageSpent}%)` : `${percentageSpent}% spent`}
                    </span>
                  ) : (
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                      Budget: N/A
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: hasBudget ? '12px' : 0 }}>
                  <span style={{ fontSize: '24px', fontWeight: 700, color: isOverBudget ? '#dc2626' : 'var(--brand-orange)' }}>
                    {formatCurrency(totalSpent, budgetCurrency)}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                    {hasBudget ? `/ ${formatCurrency(activeBudget.allocated_amount, budgetCurrency)} allocated` : 'Total expenses aggregated from child jobs'}
                  </span>
                </div>
                {hasBudget && (
                  <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-raised)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, percentageSpent)}%`,
                      background: isOverBudget ? '#dc2626' : 'var(--brand-orange)',
                      borderRadius: '3px',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
                  <button
                    className="btn-ghost"
                    onClick={() => setActiveTab('budget')}
                    style={{ fontSize: '12px', padding: '4px 8px', color: 'var(--brand-orange)', borderColor: 'transparent' }}
                  >
                    View Budget Details →
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => setActiveTab('expenses')}
                    style={{ fontSize: '12px', padding: '4px 8px', color: 'var(--text-secondary)', borderColor: 'transparent' }}
                  >
                    View All Expenses →
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => navigate(`/reports?type=financial&workitem=${id}&granularity=workitem`)}
                    style={{ fontSize: '12px', padding: '4px 8px', color: 'var(--text-secondary)', borderColor: 'transparent' }}
                  >
                    Open in Reports Hub →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Jobs sidebar preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0 }}>Jobs ({jobItems.length})</p>
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
            {(plot?.role === 'owner' || plot?.role === 'project_manager' || plot?.role === 'foreman') && workItem.work_status !== 'Completed' && (
              <button className="btn-ghost" onClick={() => setShowNewJobItem(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px' }}>
                <Plus size={14} /> Add Job
              </button>
            )}
          </div>
        </div>
      )}

      {/* Jobs Tab */}
      {activeTab === 'jobitems' && (
        <div>
          {jobItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-tertiary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
                <p style={{ fontWeight: 600, margin: 0 }}>No jobs yet</p>
                <div 
                  onClick={() => setShowJobHelp(true)} 
                  style={{ display: 'flex', alignItems: 'center', color: 'var(--brand-orange)', cursor: 'pointer' }}
                >
                  <HelpCircle size={16} />
                </div>
              </div>
              <p style={{ fontSize: '14px', margin: 0 }}>Add the first job to get started.</p>
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
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{ji.start_date} → {ji.target_end_date}</p>
                  </div>
                  {ji.estimated_hours && <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>{ji.estimated_hours}h</span>}
                  <StatusPill status={ji.job_status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Finance Tab */}
      {canViewFinance && activeTab === 'finance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              className="btn-secondary"
              onClick={() => navigate(`/reports?type=financial&workitem=${id}&granularity=workitem`)}
              style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <BarChart3 size={15} /> Open in Reports Hub
            </button>
          </div>
          {/* Top Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Allocated Budget
              </span>
              <p style={{ margin: '8px 0 0', fontSize: '24px', fontWeight: 700, color: hasBudget ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                {hasBudget ? formatCurrency(activeBudget.allocated_amount, budgetCurrency) : 'N/A'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                {hasBudget ? 'Target limit for this work' : 'No budget set yet'}
              </p>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Total Spent
              </span>
              <p style={{ margin: '8px 0 0', fontSize: '24px', fontWeight: 700, color: isOverBudget ? '#dc2626' : 'var(--brand-orange)' }}>
                {formatCurrency(totalSpent, budgetCurrency)}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                Aggregated from job expenses
              </p>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Remaining Budget
              </span>
              <p style={{ margin: '8px 0 0', fontSize: '24px', fontWeight: 700, color: hasBudget ? (isOverBudget ? '#dc2626' : 'var(--text-primary)') : 'var(--text-tertiary)' }}>
                {hasBudget
                  ? (isOverBudget
                    ? `Over by ${formatCurrency(totalSpent - parseFloat(activeBudget.allocated_amount), budgetCurrency)}`
                    : formatCurrency(activeBudget.remaining_amount, budgetCurrency))
                  : 'N/A'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: isOverBudget ? '#dc2626' : 'var(--text-tertiary)' }}>
                {hasBudget ? (isOverBudget ? 'Exceeded allocation' : 'Available balance') : 'N/A'}
              </p>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Budget Spent (%)
              </span>
              <p style={{ margin: '8px 0 0', fontSize: '24px', fontWeight: 700, color: hasBudget ? (isOverBudget ? '#dc2626' : '#16a34a') : 'var(--text-tertiary)' }}>
                {hasBudget ? `${percentageSpent}%` : 'N/A'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                {hasBudget ? `${percentageSpent}% of budget used` : 'Budget not set'}
              </p>
            </div>
          </div>

          {/* Budget Action Banner */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Work Budget Management</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                  {hasBudget
                    ? `Current allocation is ${formatCurrency(activeBudget.allocated_amount, budgetCurrency)}.`
                    : 'Assign a budget to track expenses against limits.'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  className="btn-ghost"
                  onClick={handleExportFinancialReport}
                  disabled={exportingFinancial}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Download size={16} /> {exportingFinancial ? 'Generating PDF...' : 'Download PDF Report'}
                </button>
                {canManageBudget && (
                  <button
                    className="btn-primary"
                    onClick={() => setShowBudgetModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <DollarSign size={16} /> {hasBudget ? 'Edit Work Budget' : 'Set Work Budget'}
                  </button>
                )}
              </div>
            </div>

            {financialExportError && <p style={{ color: '#dc2626', fontSize: '13px', margin: '10px 0 0' }}>{financialExportError}</p>}

            {hasBudget && (
              <div style={{ marginTop: '20px' }}>
                <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-raised)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, percentageSpent)}%`,
                      background: isOverBudget ? '#dc2626' : 'var(--brand-orange)',
                      borderRadius: '4px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  <span>{percentageSpent}% spent</span>
                  <span>{isOverBudget ? 'Over Budget' : `${formatCurrency(activeBudget.remaining_amount, budgetCurrency)} remaining`}</span>
                </div>
              </div>
            )}
          </div>

          {/* Child Jobs Budget Breakdown */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Jobs Budget & Spend Breakdown</h3>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                Budget allocations and expenses logged across child jobs
              </p>
            </div>

            {jobItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-tertiary)' }}>
                <p style={{ margin: 0, fontWeight: 500 }}>No jobs found for this work.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      <th style={{ padding: '12px 14px' }}>Job</th>
                      <th style={{ padding: '12px 14px' }}>Status</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Allocated Budget</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Spent Amount</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Budget Spent (%)</th>
                      <th style={{ padding: '12px 14px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobItems.map((ji) => {
                      const jiBudget = ji.budget;
                      const jiHasBudget = jiBudget && parseFloat(jiBudget.allocated_amount) > 0;
                      const jiSpent = parseFloat(ji.spent_amount || jiBudget?.spent_amount || 0);
                      const jiPercent = jiHasBudget ? Math.round((jiSpent / parseFloat(jiBudget.allocated_amount)) * 100) : null;
                      const jiOver = jiHasBudget && jiSpent > parseFloat(jiBudget.allocated_amount);
                      return (
                        <tr
                          key={ji.id}
                          style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-raised)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td style={{ padding: '14px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ji.job_name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{ji.job_artisan}</div>
                          </td>
                          <td style={{ padding: '14px' }}>
                            <StatusPill status={ji.job_status} />
                          </td>
                          <td style={{ padding: '14px', textAlign: 'right', fontWeight: 600 }}>
                            {jiHasBudget ? formatCurrency(jiBudget.allocated_amount, jiBudget.currency || budgetCurrency) : <span style={{ color: 'var(--text-tertiary)' }}>N/A</span>}
                          </td>
                          <td style={{ padding: '14px', textAlign: 'right', fontWeight: 700, color: jiOver ? '#dc2626' : 'var(--brand-orange)' }}>
                            {formatCurrency(jiSpent, budgetCurrency)}
                          </td>
                          <td style={{ padding: '14px', textAlign: 'right', fontWeight: 700, color: jiHasBudget ? (jiOver ? '#dc2626' : '#16a34a') : 'var(--text-tertiary)' }}>
                            {jiHasBudget ? `${jiPercent}%` : 'N/A'}
                          </td>
                          <td style={{ padding: '14px', textAlign: 'center' }}>
                            <button
                              className="btn-ghost"
                              onClick={() => navigate(`/job-items/${ji.id}`)}
                              style={{ fontSize: '12px', padding: '4px 10px', color: 'var(--brand-orange)' }}
                            >
                              View Job →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Expenses Table */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Work Expenses ({expenses.length})</h3>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                Itemized expenses recorded directly or under child jobs
              </p>
            </div>
            <ExpensesTable
              expenses={expenses}
              currency={budgetCurrency}
              level="workitem"
              canDelete={canManageBudget}
              onExpenseDeleted={() => {
                fetchExpenses();
                fetchAll();
              }}
              token={token}
              emptyMessage="No expenses recorded for this work yet."
            />
          </div>
        </div>
      )}

      {/* Reports Tab (Financial Report View - Option B) */}
      {canViewFinance && activeTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Header & Export Action */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Work Financial Report</h3>
              <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-tertiary)' }}>
                Executive budget utilization, child job breakdowns, and expenditures
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {financialExportError && <span style={{ color: '#dc2626', fontSize: '13px' }}>{financialExportError}</span>}
              <button
                className="btn-primary"
                onClick={handleExportFinancialReport}
                disabled={exportingFinancial}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Download size={16} /> {exportingFinancial ? 'Generating PDF...' : 'Download Financial Report (PDF)'}
              </button>
            </div>
          </div>

          {/* Financial Metric Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '18px', padding: '20px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 6px' }}>Allocated Budget</p>
              <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {hasBudget ? formatCurrency(activeBudget.allocated_amount, budgetCurrency) : 'Not Set'}
              </p>
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '18px', padding: '20px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 6px' }}>Total Incurred</p>
              <p style={{ fontSize: '22px', fontWeight: 700, color: isOverBudget ? '#dc2626' : 'var(--brand-orange)', margin: 0 }}>
                {formatCurrency(totalSpent, budgetCurrency)}
              </p>
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '18px', padding: '20px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 6px' }}>Remaining Budget</p>
              <p style={{ fontSize: '22px', fontWeight: 700, color: isOverBudget ? '#dc2626' : '#16a34a', margin: 0 }}>
                {hasBudget ? formatCurrency(activeBudget.remaining_amount, budgetCurrency) : '—'}
              </p>
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '18px', padding: '20px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 6px' }}>Budget Utilization</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <p style={{ fontSize: '22px', fontWeight: 700, color: isOverBudget ? '#dc2626' : 'var(--text-primary)', margin: 0 }}>
                  {hasBudget ? `${percentageSpent}%` : 'N/A'}
                </p>
                {hasBudget && (
                  <span style={{ fontSize: '12px', fontWeight: 600, color: isOverBudget ? '#dc2626' : '#16a34a' }}>
                    {isOverBudget ? 'Over Budget' : 'On Track'}
                  </span>
                )}
              </div>
              {hasBudget && (
                <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-raised)', overflow: 'hidden', marginTop: '10px' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, percentageSpent)}%`,
                    background: isOverBudget ? '#dc2626' : 'var(--brand-orange)',
                    borderRadius: '3px',
                  }} />
                </div>
              )}
            </div>
          </div>

          {/* Child Jobs Budget Breakdown */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Child Jobs Breakdown</h4>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                Comparative budget vs expenditure per child job
              </p>
            </div>
            {jobItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-tertiary)' }}>
                <p style={{ margin: 0, fontWeight: 500 }}>No jobs found for this work.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      <th style={{ padding: '12px 14px' }}>Job</th>
                      <th style={{ padding: '12px 14px' }}>Status</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Allocated Budget</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Spent Amount</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Budget Spent (%)</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobItems.map((ji) => {
                      const jiBudget = ji.budget;
                      const jiHasBudget = jiBudget && parseFloat(jiBudget.allocated_amount) > 0;
                      const jiSpent = parseFloat(ji.spent_amount || jiBudget?.spent_amount || 0);
                      const jiPercent = jiHasBudget ? Math.round((jiSpent / parseFloat(jiBudget.allocated_amount)) * 100) : null;
                      const jiOver = jiHasBudget && jiSpent > parseFloat(jiBudget.allocated_amount);
                      return (
                        <tr
                          key={ji.id}
                          style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-raised)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td style={{ padding: '14px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ji.job_name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{ji.job_artisan}</div>
                          </td>
                          <td style={{ padding: '14px' }}>
                            <StatusPill status={ji.job_status} />
                          </td>
                          <td style={{ padding: '14px', textAlign: 'right', fontWeight: 600 }}>
                            {jiHasBudget ? formatCurrency(jiBudget.allocated_amount, jiBudget.currency || budgetCurrency) : <span style={{ color: 'var(--text-tertiary)' }}>N/A</span>}
                          </td>
                          <td style={{ padding: '14px', textAlign: 'right', fontWeight: 700, color: jiOver ? '#dc2626' : 'var(--brand-orange)' }}>
                            {formatCurrency(jiSpent, budgetCurrency)}
                          </td>
                          <td style={{ padding: '14px', textAlign: 'right', fontWeight: 700, color: jiHasBudget ? (jiOver ? '#dc2626' : '#16a34a') : 'var(--text-tertiary)' }}>
                            {jiHasBudget ? `${jiPercent}%` : 'N/A'}
                          </td>
                          <td style={{ padding: '14px', textAlign: 'right' }}>
                            <button
                              className="btn-ghost"
                              onClick={() => navigate(`/job-items/${ji.id}`)}
                              style={{ fontSize: '12px', padding: '4px 10px', color: 'var(--brand-orange)' }}
                            >
                              View Job →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Itemized Expenses Table */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Itemized Expenses ({expenses.length})</h4>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                Detailed list of all expenses incurred under this work
              </p>
            </div>
            <ExpensesTable
              expenses={expenses}
              currency={budgetCurrency}
              level="workitem"
              canDelete={canManageBudget}
              onExpenseDeleted={() => {
                fetchExpenses();
                fetchAll();
              }}
              token={token}
              emptyMessage="No expenses recorded for this work yet."
            />
          </div>
        </div>
      )}

      {/* Photos Tab */}
      {activeTab === 'photos' && (
        <div>
          <div style={{ marginBottom: '28px', background: 'var(--bg-card)', padding: '24px', borderRadius: '18px', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '17px', margin: '0 0 16px', fontWeight: 600 }}>Add Photos</h3>
            <ImageUploader
              files={stagedPhotos}
              onChange={setStagedPhotos}
              label="Select Photos"
              max={20}
              onUpload={handleSavePhotos}
              uploading={uploadingPhotos}
              uploadButtonText="Upload"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', margin: 0 }}>Gallery ({workItem.images?.length || 0})</h3>
          </div>

          {workItem.images?.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px' }}>
              {workItem.images.map(img => (
                <div key={img.id} style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
                  <img src={getMediaUrl(img.image || img.img)} alt={img.caption || ''} style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(img.id)}
                    title="Delete photo"
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(0, 0, 0, 0.65)',
                      border: 'none',
                      borderRadius: '8px',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#fff',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.65)'; }}
                  >
                    <Trash2 size={14} />
                  </button>
                  {img.caption && <p style={{ margin: 0, padding: '8px 10px', fontSize: '12px', color: 'var(--text-secondary)' }}>{img.caption}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
              <ImageIcon size={36} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
              <p style={{ fontWeight: 600, margin: '0 0 4px' }}>No photos yet</p>
              <p style={{ fontSize: '13px', margin: 0 }}>Select photos above and click "Add Photo" to save them to this work.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showNewJobItem && (
        <FormOverlay onClose={() => setShowNewJobItem(false)}>
          <NewJobItemForm projectId={projectId} plotId={plotId} workItemId={id} token={token} onSuccess={fetchAll} onClose={() => setShowNewJobItem(false)} />
        </FormOverlay>
      )}

      {showAttachModal && (
        <FormOverlay onClose={() => setShowAttachModal(false)}>
          <AttachPhotosModal
            projectId={projectId}
            plotId={plotId}
            workItemId={id}
            token={token}
            onSuccess={fetchAll}
            onClose={() => setShowAttachModal(false)}
          />
        </FormOverlay>
      )}

      {/* Budget Modal */}
      {showBudgetModal && (
        <BudgetModal
          isOpen={showBudgetModal}
          token={token}
          budgetUrl={`/workitems/${id}/budget/`}
          currentBudget={activeBudget}
          entityName="Work"
          onClose={() => setShowBudgetModal(false)}
          onSave={(data) => {
            if (data) setBudget(data);
            fetchAll();
          }}
        />
      )}

      <Modal isOpen={showJobHelp} onClose={() => setShowJobHelp(false)} title="What is a Job Item?">
        <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          <strong>Jobs</strong> (or Job Items) are specific tasks assigned to artisans or teams within a Work Item.
        </p>
        <p style={{ marginTop: '16px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          <strong>Example:</strong> If the Work is "Foundation Laying", a Job could be "Trench Excavation" or "Pouring Concrete".
          <br /><br />
          Jobs are where you submit Daily Reports to update progress and track issues.
        </p>
      </Modal>
    </div>
  );
};

export default WorkItemDetailPage;
