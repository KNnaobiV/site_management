import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Edit2, Plus, FileText, UserPlus, MoreHorizontal, MapPin, Calendar, Users, Search, Loader, X, HardHat, Package, Briefcase, Image as ImageIcon, DollarSign, Download, BarChart3, HelpCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList, formatApiError, getMediaUrl } from '../api/client';
import { Breadcrumb, Tabs, Avatar, Spinner, RoleBadge, InviteModal, DocumentList, ProgressDonut, Modal } from '../components';
import BudgetModal from '../components/BudgetModal';
import ExpensesTable from '../components/ExpensesTable';
import { showSuccessMessage } from '../utils/successMessage';

// ─── Status pill ──────────────────────────────────────────────────────────────
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
  const coverInputRef = useRef(null);
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [coverImagePreview, setCoverImagePreview] = useState(null);
  const [form, setForm] = useState({
    plot_number: '',
    address: '',
    status: 'Planned',
    start_date: new Date().toISOString().split('T')[0],
    target_end_date: new Date().toISOString().split('T')[0],
    gps_latitude: '',
    gps_longitude: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCoverSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverImageFile(file);
      setCoverImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError(null);
    const payload = {
      address: form.address,
      plot_number: form.plot_number || '',
      status: form.status || 'Planned',
      start_date: form.start_date,
      target_end_date: form.target_end_date,
    };
    if (form.gps_latitude) payload.gps_latitude = parseFloat(form.gps_latitude);
    if (form.gps_longitude) payload.gps_longitude = parseFloat(form.gps_longitude);
    if (form.notes) payload.notes = form.notes;

    let body;
    if (coverImageFile) {
      body = new FormData();
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== null && v !== undefined) {
          if (Array.isArray(v)) {
            v.forEach(item => body.append(k, item));
          } else {
            body.append(k, v);
          }
        }
      });
      body.append('cover_image', coverImageFile);
    } else {
      body = JSON.stringify(payload);
    }

    try {
      const res = await apiFetch(`/projects/${projectId}/plots/`, { method: 'POST', token, body });
      if (res.ok) { showSuccessMessage('Plot created ✅'); onSuccess(); onClose(); }
      else { const d = await res.json(); setError(formatApiError(d)); }
    } catch { setError('Connection error.'); } finally { setSaving(false); }
  };

  return (
    <div className="fade-in" style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '44px', maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}>
      <h2 style={{ fontSize: '32px', marginBottom: '6px' }}>New Plot</h2>
      <p style={{ color: 'var(--text-tertiary)', marginBottom: '32px' }}>Add a new construction plot to this project.</p>
      {error && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', fontSize: '14px' }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={labelStyle}>Plot Number <span style={{ color: "var(--brand-orange)" }}>*</span></label>
          <input type="text" required value={form.plot_number} onChange={e => set('plot_number', e.target.value)} placeholder="e.g. Plot 101" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Address <span style={{ color: "var(--brand-orange)" }}>*</span></label>
          <input type="text" required value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St, City" style={inputStyle} />
        </div>
        <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Status <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
            <select value={form.status} onChange={e => set('status', e.target.value)} style={inputStyle}>
              {['Planned', 'In Progress', 'Completed', 'On Hold', 'Delayed', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
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
            <label style={labelStyle}>GPS Latitude <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
            <input type="number" step="any" value={form.gps_latitude} onChange={e => set('gps_latitude', e.target.value)} placeholder="e.g. 6.524379" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>GPS Longitude <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
            <input type="number" step="any" value={form.gps_longitude} onChange={e => set('gps_longitude', e.target.value)} placeholder="e.g. 3.379206" style={inputStyle} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Notes <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes about this plot..." style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} />
        </div>

        {/* Cover Image */}
        <div>
          <label style={labelStyle}>Cover Image <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
          <input
            type="file"
            ref={coverInputRef}
            accept="image/*"
            onChange={handleCoverSelect}
            style={{ display: 'none' }}
          />
          <div style={{
            borderRadius: '16px',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-canvas)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '16px'
          }}>
            {coverImagePreview ? (
              <div style={{ position: 'relative', width: '100%', height: '140px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                <img
                  src={coverImagePreview}
                  alt="Plot cover"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            ) : (
              <div
                onClick={() => coverInputRef.current?.click()}
                style={{
                  height: '100px',
                  border: '2px dashed var(--border-default)',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  background: 'var(--bg-raised)'
                }}
              >
                <ImageIcon size={24} color="var(--text-tertiary)" />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Click to upload plot cover image</span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                <Camera size={14} /> {coverImagePreview ? 'Change Image' : 'Select Image'}
              </button>
              {coverImagePreview && (
                <button
                  type="button"
                  onClick={() => { setCoverImageFile(null); setCoverImagePreview(null); }}
                  className="btn-ghost"
                  style={{ padding: '8px 14px', fontSize: '13px', color: 'var(--status-delayed)' }}
                >
                  <Trash2 size={14} /> Remove
                </button>
              )}
            </div>
          </div>
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


// ─── Status badge for invitation ──────────────────────────────────────────────
const inviteStatusStyle = {
  pending: { bg: '#fef3ec', text: '#c14a1e' },
  accepted: { bg: '#e8f5e9', text: '#2d5a27' },
  declined: { bg: '#fce4ec', text: '#a32a2a' },
  revoked: { bg: '#f5f5f5', text: '#9e9e9e' },
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const id = projectId;
  const { token, user: currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [plots, setPlots] = useState([]);
  const [reports, setReports] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [budget, setBudget] = useState(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showPlotHelp, setShowPlotHelp] = useState(false);
  const [showReportHelp, setShowReportHelp] = useState(false);
  const [showNewPlot, setShowNewPlot] = useState(false);
  const [showProjectInvite, setShowProjectInvite] = useState(false);

  // Team tab state
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(false);

  // Report sub-navigation & export state
  const [reportType, setReportType] = useState('job'); // 'job' | 'financial'
  const [exportingJob, setExportingJob] = useState(false);
  const [jobExportError, setJobExportError] = useState(null);
  const [exportingFinancial, setExportingFinancial] = useState(false);
  const [financialExportError, setFinancialExportError] = useState(null);

  useEffect(() => { fetchAll(); }, [id]);

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (tab) setActiveTab(tab);
  }, [location.search]);

  useEffect(() => {
    if (activeTab === 'team') fetchInvitations();
    if (activeTab === 'reports' && (project?.role === 'owner' || project?.role === 'project_manager')) {
      fetchReports();
    }
  }, [activeTab, project?.role]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const projRes = await apiFetch(`/projects/${id}/`, { token });
      let p = null;
      if (projRes.ok) {
        p = await projRes.json();
        setProject(p);
        if (p.budget) setBudget(p.budget);
      }
      const canSeeReports = p?.role === 'owner' || p?.role === 'project_manager';

      const [plotsRes, reportsRes, expRes, bRes] = await Promise.all([
        apiFetch(`/projects/${id}/plots/`, { token }),
        canSeeReports ? apiFetch(`/projects/${id}/reports/`, { token }) : Promise.resolve(null),
        apiFetch(`/projects/${id}/expenses/`, { token }),
        apiFetch(`/projects/${id}/budget/`, { token }),
      ]);
      if (plotsRes.ok) setPlots(unwrapList(await plotsRes.json()));
      if (reportsRes && reportsRes.ok) setReports(unwrapList(await reportsRes.json()));
      if (expRes.ok) setExpenses(unwrapList(await expRes.json()));
      if (bRes.ok) setBudget(await bRes.json());
    } catch (e) {
      console.error('Fetch error in ProjectDetailPage:', e);
    } finally { setLoading(false); }
  };

  const fetchExpenses = async () => {
    try {
      const expRes = await apiFetch(`/projects/${id}/expenses/`, { token });
      if (expRes.ok) setExpenses(unwrapList(await expRes.json()));
      const bRes = await apiFetch(`/projects/${id}/budget/`, { token });
      if (bRes.ok) setBudget(await bRes.json());
      const projRes = await apiFetch(`/projects/${id}/`, { token });
      if (projRes.ok) setProject(await projRes.json());
    } catch (e) { console.error('Error fetching project expenses', e); }
  };

  const fetchReports = async () => {
    try {
      const res = await apiFetch(`/projects/${id}/reports/`, { token });
      if (res.ok) setReports(unwrapList(await res.json()));
    } catch (e) { console.error('Error fetching project reports', e); }
  };

  // Fetch all project + plot invitations and merge, filtered to this project
  const fetchInvitations = async () => {
    setLoadingInvites(true);
    try {
      const [projInvRes, plotInvRes] = await Promise.all([
        apiFetch('/invitations/projects/', { token }),
        apiFetch('/invitations/plots/', { token }),
      ]);

      const projectInvites = projInvRes.ok
        ? unwrapList(await projInvRes.json())
          .filter(inv => inv.project === parseInt(id) || inv.project?.id === parseInt(id))
          .map(inv => ({ ...inv, _type: 'project', _scopeLabel: 'Project' }))
        : [];

      const plotInvites = plotInvRes.ok
        ? unwrapList(await plotInvRes.json())
          .filter(inv => {
            // Filter only invitations belonging to plots in this project
            return inv.project_name === project?.project_name ||
              (inv.plot && plots.some(p => p.id === inv.plot));
          })
          .map(inv => ({ ...inv, _type: 'plot', _scopeLabel: inv.plot_address || 'Plot' }))
        : [];

      // Merge and sort newest first
      const merged = [...projectInvites, ...plotInvites]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setPendingInvites(merged);
    } catch (e) {
      console.error('Error fetching invitations', e);
    } finally { setLoadingInvites(false); }
  };

  const handleRevoke = async (inv) => {
    if (!window.confirm('Revoke this invitation?')) return;
    const url = inv._type === 'plot'
      ? `/invitations/plots/${inv.id}/revoke/`
      : `/invitations/projects/${inv.id}/revoke/`;
    try {
      const res = await apiFetch(url, { method: 'POST', token });
      if (res.ok) { showSuccessMessage('Invitation revoked'); fetchInvitations(); }
    } catch (e) { console.error(e); }
  };

  const handleExportJobReports = async () => {
    setExportingJob(true);
    setJobExportError(null);
    try {
      const res = await apiFetch(`/projects/${id}/export-reports/`, { token });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || 'Unable to export job reports.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `project_${id}_reports_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setJobExportError(err.message || 'Job reports export failed.');
    } finally {
      setExportingJob(false);
    }
  };

  const handleExportFinancialReport = async () => {
    setExportingFinancial(true);
    setFinancialExportError(null);
    try {
      const res = await apiFetch(`/projects/${id}/export-financial-report/`, { token });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || 'Unable to export financial report.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `project_${id}_financial_report_${new Date().toISOString().split('T')[0]}.pdf`;
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

  const isForemanOnAnyPlot = plots.some(p => {
    return p.foremen && currentUser && p.foremen.some(f => (f.id || f) === currentUser.id);
  });

  const canViewFinance =
    project?.role === 'owner' ||
    project?.role === 'project_manager';

  const canViewReports =
    project?.role === 'owner' ||
    project?.role === 'project_manager' ||
    project?.role === 'foreman' ||
    project?.role === 'consultant';

  useEffect(() => {
    if (activeTab === 'reports' && !canViewReports && !loading) {
      setActiveTab('overview');
    }
  }, [activeTab, canViewReports, loading]);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'plots', label: `Plots (${plots.length})` },
    ...(canViewFinance ? [{ id: 'finance', label: 'Finance' }] : []),
    ...(canViewReports ? [{ id: 'reports', label: `Reports (${reports.length})` }] : []),
    { id: 'documents', label: 'Documents' },
    { id: 'team', label: 'Team' },
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

  const owner = project.created_by;

  const canManage = project.role === 'owner' || project.role === 'project_manager';

  const formatCurrency = (amount, currency = 'NGN') => {
    try {
      const locale = currency === 'USD' ? 'en-US' : currency === 'GBP' ? 'en-GB' : 'en-NG';
      return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(amount));
    } catch {
      return `${currency} ${Number(amount).toLocaleString()}`;
    }
  };

  const activeBudget = budget || project.budget || null;
  const totalSpent = parseFloat(activeBudget?.spent_amount ?? project.spent_amount ?? 0);
  const budgetCurrency = activeBudget?.currency || 'NGN';
  const hasBudget = activeBudget && parseFloat(activeBudget.allocated_amount) > 0;
  const percentageSpent = hasBudget ? Math.round((totalSpent / parseFloat(activeBudget.allocated_amount)) * 100) : null;
  const isOverBudget = hasBudget && totalSpent > parseFloat(activeBudget.allocated_amount);

  const renderRoleSection = (title, members, displayRole) => (
    <div style={{ marginBottom: '24px' }}>
      <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 12px' }}>{title}</p>
      {(!members || members.length === 0) ? (
        <div style={{ padding: '16px 24px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', color: 'var(--text-tertiary)' }}>
          N/A
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {members.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 24px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px' }}>
              <Avatar name={m.display_name || m.username} size={40} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)', fontSize: '15px' }}>{m.display_name || m.username}</p>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-tertiary)' }}>{m.email}</p>
              </div>
              <RoleBadge role={displayRole} />
            </div>
          ))}
        </div>
      )}
    </div>
  );

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
          {canManage && (
            <>
              <button className="btn-ghost" onClick={() => setShowBudgetModal(true)}>
                <DollarSign size={16} /> {hasBudget ? 'Edit Budget' : 'Set Budget'}
              </button>
              <button className="btn-ghost" onClick={() => navigate(`/projects/${id}/edit`)}>
                <Edit2 size={16} /> Edit
              </button>
              <button className="btn-primary" onClick={() => navigate(`/projects/${id}/plots/new`)}>
                <Plus size={16} /> Add Plot
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} style={{ marginBottom: '36px', marginTop: '24px' }} />

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Info cards row */}
          <ul className="horizontal-list-mobile project-info-row">
            {pm && (
              <li style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
                <p className="info-title" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '14px' }}>Project Manager</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <Avatar name={pm.display_name || pm.username} size={44} />
                  <div>
                    <p className="info-name" style={{ fontWeight: 700, margin: 0, color: 'var(--text-primary)', fontSize: '17px' }}>{pm.display_name || pm.username}</p>
                    <p className="info-sub" style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Project Manager</p>
                  </div>
                </div>
                {pm.email && <p className="info-sub" style={{ margin: '0 0 4px', fontSize: '13px', color: 'var(--text-secondary)' }}>✉ {pm.email}</p>}
              </li>
            )}
            {client && (
              <li style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
                <p className="info-title" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '14px' }}>Client</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <Avatar name={client.display_name || client.username} size={44} />
                  <div>
                    <p className="info-name" style={{ fontWeight: 700, margin: 0, color: 'var(--text-primary)', fontSize: '17px' }}>{client.display_name || client.username}</p>
                    <p className="info-sub" style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Client</p>
                  </div>
                </div>
                {client.email && <p className="info-sub" style={{ margin: '0 0 4px', fontSize: '13px', color: 'var(--text-secondary)' }}>✉ {client.email}</p>}
              </li>
            )}
            <li style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
              <p className="info-title" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '14px' }}>Dates</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <Calendar size={18} color="var(--text-tertiary)" />
                <div>
                  <p className="info-name" style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{project.start_date || '—'}</p>
                  <p className="info-sub" style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Start Date</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calendar size={18} color="var(--text-tertiary)" />
                <div>
                  <p className="info-name" style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{project.target_end_date}</p>
                  <p className="info-sub" style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Target End Date</p>
                </div>
              </div>
            </li>
            <li style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
              <p className="info-title" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '14px' }}>Plots</p>
              <p className="info-count" style={{ fontSize: '48px', fontFamily: 'var(--font-serif)', margin: '0 0 4px', color: 'var(--text-primary)', lineHeight: 1 }}>{plots.length}</p>
              <p className="info-sub" style={{ margin: 0, fontSize: '13px', color: 'var(--text-tertiary)' }}>of {project.number_of_plots} planned</p>
            </li>
            <li style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <p className="info-title" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '10px', alignSelf: 'flex-start' }}>Progress</p>
              <ProgressDonut percent={project.progress ?? 0} size={84} strokeWidth={8} />
              <p className="info-sub" style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                {project.is_progress_manual ? 'Manual override' : 'Weighted duration'}
              </p>
            </li>
            {/* Financial / Budget Card */}
            {canViewFinance && (
              <li style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <p className="info-title" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0 }}>Expenses & Budget</p>
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
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '24px', color: isOverBudget ? '#dc2626' : 'var(--brand-orange)' }}>
                  {formatCurrency(totalSpent, budgetCurrency)}
                </p>
                <p className="info-sub" style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                  {hasBudget ? `/ ${formatCurrency(activeBudget.allocated_amount, budgetCurrency)} allocated` : 'Aggregated across all plots'}
                </p>
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
                    onClick={() => setActiveTab('finance')}
                    style={{ fontSize: '12px', padding: '4px 8px', color: 'var(--brand-orange)', borderColor: 'transparent' }}
                  >
                    View Finance Details →
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => navigate(`/reports?type=financial&project=${id}&granularity=project`)}
                    style={{ fontSize: '12px', padding: '4px 8px', color: 'var(--text-secondary)', borderColor: 'transparent' }}
                  >
                    Open in Reports Hub →
                  </button>
                </div>
              </li>
            )}
          </ul>

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
                        {plot.plot_name ? plot.plot_name : 'Plot'}
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
            {canManage && (
              <button className="btn-primary" onClick={() => navigate(`/projects/${id}/plots/new`)}>
                <Plus size={16} /> Add Plot
              </button>
            )}
          </div>
          {plots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-tertiary)' }}>
              <MapPin size={40} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <p style={{ fontWeight: 600, margin: 0 }}>No plots yet</p>
                <div 
                  onClick={() => setShowPlotHelp(true)} 
                  style={{ display: 'flex', alignItems: 'center', color: 'var(--brand-orange)', cursor: 'pointer' }}
                >
                  <HelpCircle size={16} />
                </div>
              </div>
              <p style={{ fontSize: '14px', margin: '8px 0 0' }}>Add the first plot to get started.</p>
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
                      {plot.plot_name ? plot.plot_name : 'Plot'}
                    </p>
                  </div>
                  <p style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={13} /> {plot.address}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <StatusPill status={'Planned'} />
                    {plot.foremen && plot.foremen.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Avatar name={plot.foremen[0].display_name || plot.foremen[0].username} size={28} />
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

      {/* Finance Tab */}
      {canViewFinance && activeTab === 'finance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              className="btn-secondary"
              onClick={() => navigate(`/reports?type=financial&project=${id}&granularity=project`)}
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
                {hasBudget ? 'Target limit for this project' : 'No budget set yet'}
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
                Aggregated across all plots in project
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
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Project Budget Management</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                  {hasBudget
                    ? `Current allocation is ${formatCurrency(activeBudget.allocated_amount, budgetCurrency)}.`
                    : 'Assign an overall budget to track and limit total spending across all plots.'}
                </p>
              </div>
              {canManage && (
                <button
                  className="btn-primary"
                  onClick={() => setShowBudgetModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <DollarSign size={16} /> {hasBudget ? 'Edit Project Budget' : 'Set Project Budget'}
                </button>
              )}
            </div>

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

          {/* Child Plots Budget Breakdown */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Plots Budget & Spend Breakdown</h3>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                Budget allocations and expenses logged across plots in this project
              </p>
            </div>

            {plots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-tertiary)' }}>
                <p style={{ margin: 0, fontWeight: 500 }}>No plots found for this project.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      <th style={{ padding: '12px 14px' }}>Plot</th>
                      <th style={{ padding: '12px 14px' }}>Status</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Allocated Budget</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Spent Amount</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>% Spent</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plots.map(plot => {
                      const plotBudget = plot.budget;
                      const plotAllocated = parseFloat(plotBudget?.allocated_amount || 0);
                      const plotSpent = parseFloat(plotBudget?.spent_amount ?? plot.spent_amount ?? 0);
                      const plotHasBudget = plotAllocated > 0;
                      const plotPercent = plotHasBudget ? Math.round((plotSpent / plotAllocated) * 100) : null;
                      const plotOver = plotHasBudget && plotSpent > plotAllocated;

                      return (
                        <tr key={plot.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            <div>{plot.plot_name || `Plot #${plot.plot_number || plot.id}`}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 400 }}>{plot.address}</div>
                          </td>
                          <td style={{ padding: '14px' }}>
                            <StatusPill status={plot.work_status || 'Planned'} />
                          </td>
                          <td style={{ padding: '14px', textAlign: 'right', color: plotHasBudget ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                            {plotHasBudget ? formatCurrency(plotAllocated, plotBudget?.currency || budgetCurrency) : 'N/A'}
                          </td>
                          <td style={{ padding: '14px', textAlign: 'right', fontWeight: 600, color: plotOver ? '#dc2626' : 'var(--text-primary)' }}>
                            {formatCurrency(plotSpent, plotBudget?.currency || budgetCurrency)}
                          </td>
                          <td style={{ padding: '14px', textAlign: 'right' }}>
                            {plotHasBudget ? (
                              <span style={{ fontWeight: 600, color: plotOver ? '#dc2626' : plotPercent > 80 ? '#d97706' : '#16a34a' }}>
                                {plotPercent}%
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-tertiary)' }}>N/A</span>
                            )}
                          </td>
                          <td style={{ padding: '14px', textAlign: 'right' }}>
                            <button
                              className="btn-ghost"
                              onClick={() => navigate(`/plots/${plot.id}`)}
                              style={{ fontSize: '12px', padding: '4px 10px' }}
                            >
                              View Plot →
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
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Project Expenses</h3>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                Itemized expenses incurred across all plots and works in this project
              </p>
            </div>
            <ExpensesTable
              expenses={expenses}
              currency={budgetCurrency}
              level="project"
              canDelete={canManage}
              onExpenseDeleted={() => {
                fetchExpenses();
                fetchAll();
              }}
              token={token}
            />
          </div>
        </div>
      )}

      {/* Team Tab */}
      {activeTab === 'team' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

          {/* Current Members */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0 }}>Current Members</p>
              {canManage && (
                <button className="btn-primary" onClick={() => setShowProjectInvite(true)}>
                  <UserPlus size={16} /> Invite
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {renderRoleSection('Owner', owner ? [owner] : [], 'owner')}
              {renderRoleSection('Client', client ? [client] : [], 'client')}
              {renderRoleSection('Project Manager', pm ? [pm] : [], 'project_manager')}
              {renderRoleSection('Consultants', consultants, 'consultant')}
            </div>
          </div>


          {/* Pending Invitations Table */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0 }}>
                Pending Invitations ({pendingInvites.length})
              </p>
              {loadingInvites && <Spinner />}
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-raised)' }}>
                    <th style={thStyle}>INVITEE</th>
                    <th style={thStyle}>ROLE</th>
                    <th style={thStyle}>SCOPE</th>
                    <th style={thStyle}>STATUS</th>
                    <th style={thStyle}>SENT</th>
                    <th style={thStyle}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingInvites.map((inv, i) => {
                    const s = inviteStatusStyle[inv.status] || inviteStatusStyle.pending;
                    const isLast = i === pendingInvites.length - 1;
                    return (
                      <tr key={`${inv._type}-${inv.id}`} style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Avatar name={inv.invitee?.display_name || inv.invitee?.username || '?'} size={32} />
                            <div>
                              <p style={{ margin: 0, fontWeight: 600, fontSize: '13px' }}>{inv.invitee?.display_name || inv.invitee?.username}</p>
                              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>{inv.invitee?.email}</p>
                            </div>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 600, fontSize: '13px', textTransform: 'capitalize' }}>{inv.role?.replace('_', ' ')}</span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '3px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: 600,
                            background: inv._type === 'project' ? 'rgba(249,115,22,0.1)' : 'rgba(99,102,241,0.1)',
                            color: inv._type === 'project' ? 'var(--brand-orange)' : '#6366f1',
                          }}>
                            {inv._type === 'project' ? <Briefcase size={11} /> : <MapPin size={11} />}
                            {inv._type === 'project' ? 'Project' : inv._scopeLabel}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 600, background: s.bg, color: s.text }}>
                            {inv.status}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                            {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {inv.status === 'pending' && (
                            <button
                              onClick={() => handleRevoke(inv)}
                              style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 600, fontSize: '13px', cursor: 'pointer', padding: 0 }}
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {pendingInvites.length === 0 && !loadingInvites && (
                    <tr>
                      <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '14px' }}>
                        No invitations yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Sub-navigation pill toggle: Job Reports vs Financial Report */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'inline-flex', padding: '4px', background: 'var(--bg-raised)', borderRadius: '14px', border: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setReportType('job')}
                style={{
                  padding: '8px 18px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: reportType === 'job' ? 'var(--bg-card)' : 'transparent',
                  color: reportType === 'job' ? 'var(--brand-orange)' : 'var(--text-tertiary)',
                  boxShadow: reportType === 'job' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <FileText size={16} /> Job Reports ({reports.length})
              </button>
              <button
                type="button"
                onClick={() => setReportType('financial')}
                style={{
                  padding: '8px 18px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: reportType === 'financial' ? 'var(--bg-card)' : 'transparent',
                  color: reportType === 'financial' ? 'var(--brand-orange)' : 'var(--text-tertiary)',
                  boxShadow: reportType === 'financial' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <DollarSign size={16} /> Financial Report
              </button>
            </div>
          </div>

          {/* ─── View 1: Job Reports ─── */}
          {reportType === 'job' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Job Reports Header & Export Action */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Project Job Reports</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-tertiary)' }}>
                    Aggregated daily site logs across all plots in this project
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {jobExportError && <span style={{ color: '#dc2626', fontSize: '13px' }}>{jobExportError}</span>}
                  <button
                    className="btn-primary"
                    onClick={handleExportJobReports}
                    disabled={exportingJob || reports.length === 0}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Download size={16} /> {exportingJob ? 'Generating PDF...' : 'Export Job Reports (PDF)'}
                  </button>
                </div>
              </div>

              {reports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-tertiary)' }}>
                  <FileText size={40} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
                    <p style={{ fontWeight: 600, margin: 0 }}>No reports available yet</p>
                    <div 
                      onClick={() => setShowReportHelp(true)} 
                      style={{ display: 'flex', alignItems: 'center', color: 'var(--brand-orange)', cursor: 'pointer' }}
                    >
                      <HelpCircle size={16} />
                    </div>
                  </div>
                  <p style={{ fontSize: '14px' }}>Daily reports from works will appear here once created.</p>
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
                            {report.job_item_name || 'Job report'} • {report.work_item_name || 'Work'} • {report.construction_plot || project.project_name}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{report.percentage_job_progress}% complete</span>
                          <StatusPill status={report.priority || 'Planned'} />
                        </div>
                      </div>
                      {report.notes && <p style={{ margin: '16px 0 0', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{report.notes}</p>}
                      {report.video_link && (
                        <div style={{ marginTop: '8px' }}>
                          <a href={report.video_link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--brand-orange)', textDecoration: 'none', fontWeight: 600 }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                            View Video
                          </a>
                        </div>
                      )}
                      {report.issues_encountered && <p style={{ margin: '10px 0 0', fontSize: '13px', color: 'var(--status-delayed)' }}>⚠ {report.issues_encountered}</p>}
                      {report.images?.length > 0 && (
                        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                            <ImageIcon size={14} /> {report.images.length} photo{report.images.length > 1 ? 's' : ''}
                          </span>
                          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '2px 0' }}>
                            {report.images.slice(0, 5).map(img => (
                              <img
                                key={img.id}
                                src={getMediaUrl(img.image || img.img)}
                                alt="Report thumbnail"
                                style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-subtle)', background: 'var(--bg-raised)' }}
                              />
                            ))}
                            {report.images.length > 5 && (
                              <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)' }}>
                                +{report.images.length - 5}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── View 2: Financial Report ─── */}
          {reportType === 'financial' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Header & Export Action */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Project Financial Report</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-tertiary)' }}>
                    Executive budget utilization, plot breakdowns, and project expenditures
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

              {/* Plots Budget & Spend Breakdown Table */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Plots Budget Breakdown</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                    Comparative allocated budget and spent amounts across project plots
                  </p>
                </div>
                {plots.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-tertiary)' }}>
                    <p style={{ margin: 0, fontWeight: 500 }}>No plots found for this project.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          <th style={{ padding: '12px 14px' }}>Plot</th>
                          <th style={{ padding: '12px 14px' }}>Status</th>
                          <th style={{ padding: '12px 14px', textAlign: 'right' }}>Allocated Budget</th>
                          <th style={{ padding: '12px 14px', textAlign: 'right' }}>Spent Amount</th>
                          <th style={{ padding: '12px 14px', textAlign: 'right' }}>% Spent</th>
                          <th style={{ padding: '12px 14px', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plots.map(plot => {
                          const plotBudget = plot.budget;
                          const plotAllocated = parseFloat(plotBudget?.allocated_amount || 0);
                          const plotSpent = parseFloat(plotBudget?.spent_amount ?? plot.spent_amount ?? 0);
                          const plotHasBudget = plotAllocated > 0;
                          const plotPercent = plotHasBudget ? Math.round((plotSpent / plotAllocated) * 100) : null;
                          const plotOver = plotHasBudget && plotSpent > plotAllocated;

                          return (
                            <tr key={plot.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {plot.plot_name ? `${plot.plot_name} (${plot.address})` : plot.address}
                              </td>
                              <td style={{ padding: '14px' }}>
                                <StatusPill status={plot.status || 'Planned'} />
                              </td>
                              <td style={{ padding: '14px', textAlign: 'right', color: plotHasBudget ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                                {plotHasBudget ? formatCurrency(plotAllocated, plotBudget?.currency || budgetCurrency) : 'N/A'}
                              </td>
                              <td style={{ padding: '14px', textAlign: 'right', fontWeight: 600, color: plotOver ? '#dc2626' : 'var(--text-primary)' }}>
                                {formatCurrency(plotSpent, plotBudget?.currency || budgetCurrency)}
                              </td>
                              <td style={{ padding: '14px', textAlign: 'right' }}>
                                {plotHasBudget ? (
                                  <span style={{ fontWeight: 600, color: plotOver ? '#dc2626' : plotPercent > 80 ? '#d97706' : '#16a34a' }}>
                                    {plotPercent}%
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-tertiary)' }}>N/A</span>
                                )}
                              </td>
                              <td style={{ padding: '14px', textAlign: 'right' }}>
                                <button
                                  className="btn-ghost"
                                  onClick={() => navigate(`/plots/${plot.id}`)}
                                  style={{ fontSize: '12px', padding: '4px 10px' }}
                                >
                                  View Plot →
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
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Project Expenditures</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                    Itemized expenses logged across all plots in this project
                  </p>
                </div>
                <ExpensesTable
                  expenses={expenses}
                  currency={budgetCurrency}
                  level="project"
                  canDelete={canManage}
                  onExpenseDeleted={() => {
                    fetchExpenses();
                    fetchAll();
                  }}
                  token={token}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <DocumentList projectId={id} role={project.role} />
      )}

      {/* Modals */}
      {showProjectInvite && (
        <InviteModal
          isOpen={showProjectInvite}
          onClose={() => setShowProjectInvite(false)}
          onSuccess={fetchInvitations}
          type="project"
          entityId={id}
          title="Invite to Project"
        />
      )}
      {showNewPlot && (
        <FormOverlay onClose={() => setShowNewPlot(false)}>
          <NewPlotForm projectId={id} token={token} onSuccess={fetchAll} onClose={() => setShowNewPlot(false)} />
        </FormOverlay>
      )}

      {/* Budget Modal */}
      {showBudgetModal && (
        <BudgetModal
          isOpen={showBudgetModal}
          token={token}
          budgetUrl={`/projects/${id}/budget/`}
          currentBudget={activeBudget}
          entityName="Project"
          onClose={() => setShowBudgetModal(false)}
          onSave={(data) => {
            if (data) setBudget(data);
            fetchAll();
          }}
        />
      )}

      <Modal isOpen={showPlotHelp} onClose={() => setShowPlotHelp(false)} title="What is a Plot?">
        <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          <strong>Plots</strong> represent physical subdivisions or logical phases of a Project.
        </p>
        <p style={{ marginTop: '16px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          <strong>Example:</strong> If your project is a housing estate, a Plot could be "Block A" or "Plot 12". If your project is a highway, a Plot could be "Kilometer 1-5".
          <br /><br />
          Inside a Plot, you will track specific Work Items (e.g., Foundation, Plumbing).
        </p>
      </Modal>

      <Modal isOpen={showReportHelp} onClose={() => setShowReportHelp(false)} title="What is a Report?">
        <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          <strong>Reports</strong> track daily updates and site conditions for active jobs.
        </p>
        <p style={{ marginTop: '16px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          <strong>Example:</strong> A daily log stating "Poured 50 cubic meters of concrete, faced weather delays", along with photos of the progress.
        </p>
      </Modal>
    </div>
  );
};

const thStyle = { padding: '14px 20px', fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em' };
const tdStyle = { padding: '16px 20px', fontSize: '14px', color: 'var(--text-primary)' };

export default ProjectDetailPage;
