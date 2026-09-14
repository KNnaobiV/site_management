import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Edit2, Plus, FileText, UserPlus, MoreHorizontal, MapPin, Calendar, Clock, ArrowLeft, Loader, Search, Info, DollarSign, HelpCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList, formatApiError, getMediaUrl } from '../api/client';
import { Breadcrumb, Tabs, Avatar, Spinner, ProgressDonut, InviteModal, ChecklistEditor, ImageUploader, DocumentList, Modal } from '../components';
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
    start_date: new Date().toISOString().split('T')[0],
    target_end_date: new Date().toISOString().split('T')[0],
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
      start_date: form.start_date,
      target_end_date: form.target_end_date,
      construction_plot: plotId,
    };
    if (checklist.length) payload.checklist = checklist;

    try {
      const targetProjectId = projectId?.id || projectId;
      const url = targetProjectId
        ? `/projects/${targetProjectId}/plots/${plotId}/workitems/`
        : `/workitems/`;
      const res = await apiFetch(url, { method: 'POST', token, body: JSON.stringify(payload) });
      if (res.ok) {
        const wi = await res.json();
        // Upload images if any
        for (const img of images) {
          const fd = new FormData(); fd.append('image', img);
          const imgUrl = targetProjectId
            ? `/projects/${targetProjectId}/plots/${plotId}/workitems/${wi.id}/images/`
            : `/workitems/${wi.id}/images/`;
          await apiFetch(imgUrl, { method: 'POST', token, body: fd });
        }
        showSuccessMessage('Work created ✅');
        onSuccess(); onClose();
      } else {
        const d = await res.json(); setError(formatApiError(d));
      }
    } catch { setError('Connection error.'); } finally { setSaving(false); }
  };

  return (
    <div className="fade-in" style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '44px', maxWidth: '700px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.15)' }}>
      <h2 style={{ fontSize: '32px', marginBottom: '6px' }}>New Work</h2>
      <p style={{ color: 'var(--text-tertiary)', marginBottom: '32px' }}>Define a work phase for this plot.</p>
      {error && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', fontSize: '14px' }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={labelStyle}>Work Name <span style={{ color: "var(--brand-orange)" }}>*</span></label>
          <input type="text" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Foundation Work" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Description <span style={{ color: "var(--brand-orange)" }}>*</span></label>
          <textarea required value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe the scope..." style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} />
        </div>
        <div>
          <label style={labelStyle}>Status <span style={{ color: "var(--brand-orange)" }}>*</span></label>
          <select required value={form.work_status} onChange={e => set('work_status', e.target.value)} style={inputStyle}>
            {['Planned', 'In Progress', 'Completed', 'On Hold', 'Delayed', 'Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
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


        {/* Checklist */}
        <div>
          <label style={{ ...labelStyle, marginBottom: '14px' }}>Checklist <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
          <ChecklistEditor items={checklist} onChange={setChecklist} />
        </div>

        {/* Photos */}
        <ImageUploader files={images} onChange={setImages} label="Photos" max={8} />

        <div style={{ display: 'flex', gap: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
            {saving ? 'Creating...' : '+ Create Work'}
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
  const [expenses, setExpenses] = useState([]);
  const [budget, setBudget] = useState(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showWorkHelp, setShowWorkHelp] = useState(false);
  const [showReportHelp, setShowReportHelp] = useState(false);
  const [showNewWorkItem, setShowNewWorkItem] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteRole, setInviteRole] = useState('foreman');
  const [exportScope, setExportScope] = useState('plot');
  const [exportWorkItemId, setExportWorkItemId] = useState('');
  const [exportJobItemId, setExportJobItemId] = useState('');
  const [exportRange, setExportRange] = useState({ from: '', to: '' });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  // Report sub-navigation & export state
  const [reportType, setReportType] = useState('job'); // 'job' | 'financial'
  const [exportingFinancial, setExportingFinancial] = useState(false);
  const [financialExportError, setFinancialExportError] = useState(null);

  useEffect(() => { fetchAll(); }, [projectId, id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      // 1. Fetch the plot first (flat path) to get its project ID if needed
      const plotRes = await apiFetch(`/plots/${id}/`, { token });
      if (plotRes.ok) {
        const plotData = await plotRes.json();
        setPlot(plotData);
        setBudget(plotData.budget || null);
        const pid = projectIdFromUrl || plotData.construction_project?.id || plotData.construction_project;
        setProjectId(pid);

        const canSeeReports =
          plotData.role === 'owner' ||
          plotData.role === 'project_manager' ||
          plotData.role === 'foreman';

        // 2. Fetch project, workitems, reports, expenses, budget
        const [projRes, wiRes, reportsRes, expRes, bRes] = await Promise.all([
          apiFetch(`/projects/${pid}/`, { token }),
          apiFetch(`/projects/${pid}/plots/${id}/workitems/`, { token }),
          canSeeReports ? apiFetch(`/projects/${pid}/plots/${id}/reports/`, { token }) : Promise.resolve(null),
          apiFetch(`/plots/${id}/expenses/`, { token }),
          apiFetch(`/plots/${id}/budget/`, { token }),
        ]);
        if (projRes.ok) setProject(await projRes.json());
        if (wiRes.ok) setWorkItems(unwrapList(await wiRes.json()));
        if (reportsRes && reportsRes.ok) setReports(unwrapList(await reportsRes.json()));
        if (expRes.ok) setExpenses(unwrapList(await expRes.json()));
        if (bRes.ok) setBudget(await bRes.json());
      }
    } catch (e) {
      console.error("PlotDetailPage fetch error:", e);
    } finally { setLoading(false); }
  };

  const fetchExpenses = async () => {
    try {
      const expRes = await apiFetch(`/plots/${id}/expenses/`, { token });
      if (expRes.ok) setExpenses(unwrapList(await expRes.json()));
      const bRes = await apiFetch(`/plots/${id}/budget/`, { token });
      if (bRes.ok) setBudget(await bRes.json());
      const pRes = await apiFetch(`/plots/${id}/`, { token });
      if (pRes.ok) setPlot(await pRes.json());
    } catch (e) { console.error(e); }
  };

  const fetchReports = async () => {
    try {
      const pid = projectId || plot?.construction_project?.id || plot?.construction_project;
      if (!pid) return;
      const res = await apiFetch(`/projects/${pid}/plots/${id}/reports/`, { token });
      if (res.ok) {
        const data = await res.json();
        setReports(unwrapList(data));
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

  const handleExportFinancialReport = async () => {
    setExportingFinancial(true);
    setFinancialExportError(null);
    try {
      const res = await apiFetch(`/plots/${id}/export-financial-report/`, { token });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || 'Unable to export financial report.');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `plot_${id}_financial_report_${new Date().toISOString().split('T')[0]}.pdf`;
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

  const formatCurrency = (amount, currency = 'NGN') => {
    try {
      const locale = currency === 'USD' ? 'en-US' : currency === 'GBP' ? 'en-GB' : 'en-NG';
      return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(amount));
    } catch {
      return `${currency} ${Number(amount).toLocaleString()}`;
    }
  };

  const completedItems = workItems.filter(w => w.work_status === 'Completed').length;
  const reportJobItems = Array.from(new Map(reports.map(r => [r.job_item, { id: r.job_item, name: r.job_item_name }])).values());
  const progress = plot?.progress !== undefined ? plot.progress : (workItems.length ? Math.round((completedItems / workItems.length) * 100) : 0);

  const activeBudget = budget || plot?.budget || null;
  const totalSpent = parseFloat(activeBudget?.spent_amount ?? plot?.spent_amount ?? 0);
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

  const canViewReports =
    plot?.role === 'owner' ||
    plot?.role === 'project_manager' ||
    plot?.role === 'foreman' ||
    project?.role === 'owner' ||
    project?.role === 'project_manager';

  useEffect(() => {
    if (activeTab === 'reports' && !canViewReports && !loading) {
      setActiveTab('overview');
    }
  }, [activeTab, canViewReports, loading]);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'workitems', label: `Works (${workItems.length})` },
    ...(canViewFinance ? [{ id: 'finance', label: 'Finance' }] : []),
    ...(canViewReports ? [{ id: 'reports', label: `Reports (${reports.length})` }] : []),
    { id: 'documents', label: 'Documents' },
    { id: 'team', label: 'Team' },
  ];

  if (loading) return <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}><Spinner /></div>;
  if (!plot) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Plot not found.</div>;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 0 60px' }}>
      <Breadcrumb items={[
        { label: 'Projects', to: '/projects' },
        { label: project?.project_name || '...', to: `/projects/${projectId}` },
        { label: plot.plot_name ? plot.plot_name : plot.address },
      ]} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '12px' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(28px,4vw,48px)', marginBottom: '8px', lineHeight: 1.05 }}>
            {plot.plot_name ? plot.plot_name : ''}{plot.plot_name && plot.address ? ' — ' : ''}{plot.address}
          </h1>
          {plot.notes && <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', fontSize: '15px' }}>{plot.notes}</p>}
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {(plot.role === 'owner' || plot.role === 'project_manager') && (
            <button className="btn-ghost" onClick={() => navigate(`/plots/${id}/edit`)}>
              <Edit2 size={16} /> Edit Plot
            </button>
          )}
          {canManageBudget && (
            <button className="btn-ghost" onClick={() => setShowBudgetModal(true)}>
              <DollarSign size={16} /> {hasBudget ? 'Edit Budget' : 'Set Budget'}
            </button>
          )}
          <button className="btn-ghost" onClick={() => { setInviteRole('foreman'); setShowInvite(true); }}>
            <UserPlus size={16} /> Assign Foreman
          </button>
          {(plot.role === 'owner' || plot.role === 'project_manager') && plot.status !== 'Completed' && (
            <button className="btn-primary" onClick={() => navigate(`/plots/${id}/work-items/new`)}>
              <Plus size={16} /> Add Work
            </button>
          )}
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
              {/* Foremen */}
              {(plot.foremen && plot.foremen.length > 0) && (
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 8px' }}>Foremen</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {plot.foremen.map(f => (
                      <div key={f.id || f.username} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar name={f.display_name || f.username} size={36} />
                        <div>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{f.display_name || f.username}</p>
                        </div>
                      </div>
                    ))}
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
                  {hasBudget ? `/ ${formatCurrency(activeBudget.allocated_amount, budgetCurrency)} allocated` : 'Total expenses aggregated across all works'}
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
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  className="btn-ghost"
                  onClick={() => setActiveTab('finance')}
                  style={{ fontSize: '12px', padding: '4px 8px', color: 'var(--brand-orange)', borderColor: 'transparent' }}
                >
                  View Finance Details →
                </button>
              </div>
            </div>
          )}

          {/* Work Items Preview */}
          {workItems.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0 }}>Works</p>
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
            {(plot.role === 'owner' || plot.role === 'project_manager') && plot.status !== 'Completed' && (
              <button className="btn-primary" onClick={() => setShowNewWorkItem(true)}>
                <Plus size={16} /> Add Work
              </button>
            )}
          </div>
          {workItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-tertiary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
                <p style={{ fontWeight: 600, margin: 0 }}>No works yet</p>
                <div 
                  onClick={() => setShowWorkHelp(true)} 
                  style={{ display: 'flex', alignItems: 'center', color: 'var(--brand-orange)', cursor: 'pointer' }}
                >
                  <HelpCircle size={16} />
                </div>
              </div>
              <p style={{ fontSize: '14px', margin: 0 }}>Add the first work to begin tracking progress.</p>
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
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{wi.start_date} → {wi.target_end_date}</p>
                  </div>
                  <StatusPill status={wi.work_status} />
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
              onClick={() => navigate(`/reports?type=financial&project=${plot.construction_project?.id || plot.project || ''}&plot=${id}&granularity=plot`)}
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
                {hasBudget ? 'Target limit for this plot' : 'No budget set yet'}
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
                Aggregated from all constituent works
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
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Plot Budget Management</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                  {hasBudget
                    ? `Current allocation is ${formatCurrency(activeBudget.allocated_amount, budgetCurrency)}.`
                    : 'Assign a budget to track expenses against limits for this plot.'}
                </p>
              </div>
              {canManageBudget && (
                <button
                  className="btn-primary"
                  onClick={() => setShowBudgetModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <DollarSign size={16} /> {hasBudget ? 'Edit Plot Budget' : 'Set Plot Budget'}
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

          {/* Child Works Budget Breakdown */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Works Budget & Spend Breakdown</h3>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                Budget allocations and expenses logged across child works
              </p>
            </div>

            {workItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-tertiary)' }}>
                <p style={{ margin: 0, fontWeight: 500 }}>No works found for this plot.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      <th style={{ padding: '12px 14px' }}>Work</th>
                      <th style={{ padding: '12px 14px' }}>Status</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Allocated Budget</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Spent Amount</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>% Spent</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workItems.map(wi => {
                      const wiBudget = wi.budget;
                      const wiAllocated = parseFloat(wiBudget?.allocated_amount || 0);
                      const wiSpent = parseFloat(wiBudget?.spent_amount ?? wi.spent_amount ?? 0);
                      const wiHasBudget = wiAllocated > 0;
                      const wiPercent = wiHasBudget ? Math.round((wiSpent / wiAllocated) * 100) : null;
                      const wiOver = wiHasBudget && wiSpent > wiAllocated;

                      return (
                        <tr key={wi.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {wi.name}
                          </td>
                          <td style={{ padding: '14px' }}>
                            <StatusPill status={wi.work_status} />
                          </td>
                          <td style={{ padding: '14px', textAlign: 'right', color: wiHasBudget ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                            {wiHasBudget ? formatCurrency(wiAllocated, wiBudget?.currency || budgetCurrency) : 'N/A'}
                          </td>
                          <td style={{ padding: '14px', textAlign: 'right', fontWeight: 600, color: wiOver ? '#dc2626' : 'var(--text-primary)' }}>
                            {formatCurrency(wiSpent, wiBudget?.currency || budgetCurrency)}
                          </td>
                          <td style={{ padding: '14px', textAlign: 'right' }}>
                            {wiHasBudget ? (
                              <span style={{ fontWeight: 600, color: wiOver ? '#dc2626' : wiPercent > 80 ? '#d97706' : '#16a34a' }}>
                                {wiPercent}%
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-tertiary)' }}>N/A</span>
                            )}
                          </td>
                          <td style={{ padding: '14px', textAlign: 'right' }}>
                            <button
                              className="btn-ghost"
                              onClick={() => navigate(`/work-items/${wi.id}`)}
                              style={{ fontSize: '12px', padding: '4px 10px' }}
                            >
                              View Work →
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
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Plot Expenses</h3>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                Itemized expenses incurred across all works in this plot
              </p>
            </div>
            <ExpensesTable
              expenses={expenses}
              currency={budgetCurrency}
              level="plot"
              canDelete={canManageBudget}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '24px', margin: 0 }}>Plot Team</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-primary" onClick={() => { setInviteRole('foreman'); setShowInvite(true); }}>
                <UserPlus size={16} /> Invite Foreman
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            {/* Foremen slot */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0 }}>Foremen</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {plot.foremen && plot.foremen.length > 0 ? (
                  plot.foremen.map(f => (
                    <div key={f.id || f.username} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <Avatar name={f.display_name || f.username} size={48} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>{f.display_name || f.username}</p>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{f.email}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div
                    onClick={() => { setInviteRole('foreman'); setShowInvite(true); }}
                    style={{ background: 'var(--bg-raised)', border: '2px dashed var(--border-default)', borderRadius: '12px', padding: '20px', cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand-orange)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                  >
                    <UserPlus size={24} color="var(--text-tertiary)" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>No Foreman Assigned</p>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--brand-orange)' }}>Tap to invite a foreman →</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '22px' }}>
                <div className="mobile-grid-1" style={{ display: 'grid', gap: '18px', gridTemplateColumns: '1fr 1fr', alignItems: 'end' }}>
                  <div>
                    <label style={labelStyle}>Export scope <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
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
                      <option value="workitem">Work</option>
                      <option value="jobitem">Job</option>
                    </select>
                  </div>
                  {exportScope === 'workitem' && (
                    <div>
                      <label style={labelStyle}>Work <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
                      <select
                        value={exportWorkItemId}
                        onChange={e => setExportWorkItemId(e.target.value)}
                        style={inputStyle}
                      >
                        <option value="">All works</option>
                        {workItemOptions.map(wi => (
                          <option key={wi.id} value={wi.id}>{wi.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {exportScope === 'jobitem' && (
                    <div>
                      <label style={labelStyle}>Job <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
                      <select
                        value={exportJobItemId}
                        onChange={e => setExportJobItemId(e.target.value)}
                        style={inputStyle}
                      >
                        <option value="">All jobs</option>
                        {reportJobItems.map(item => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label style={labelStyle}>From <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
                    <input
                      type="date"
                      value={exportRange.from}
                      onChange={e => setExportRange(range => ({ ...range, from: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>To <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
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
                    Export all report data for the selected plot, work, or job as a PDF.
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
                    <p style={{ fontWeight: 600, margin: 0 }}>No reports for this plot yet</p>
                    <div 
                      onClick={() => setShowWorkHelp(true)} 
                      style={{ display: 'flex', alignItems: 'center', color: 'var(--brand-orange)', cursor: 'pointer' }}
                    >
                      <HelpCircle size={16} />
                    </div>
                  </div>
                  <p style={{ fontSize: '14px' }}>Daily reports for works on this plot will appear here.</p>
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
                            {report.job_item_name || 'Job report'} • {report.work_item_name || 'Work'}
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
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Plot Financial Report</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-tertiary)' }}>
                    Executive budget utilization, work breakdowns, and expenditures
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

              {/* Works Breakdown Table */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Works Budget Breakdown</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                    Comparative budget vs expenditure per work
                  </p>
                </div>
                {workItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-tertiary)' }}>
                    <p style={{ margin: 0, fontWeight: 500 }}>No works found for this plot.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          <th style={{ padding: '12px 14px' }}>Work</th>
                          <th style={{ padding: '12px 14px' }}>Status</th>
                          <th style={{ padding: '12px 14px', textAlign: 'right' }}>Allocated Budget</th>
                          <th style={{ padding: '12px 14px', textAlign: 'right' }}>Spent Amount</th>
                          <th style={{ padding: '12px 14px', textAlign: 'right' }}>% Spent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workItems.map(wi => {
                          const wiBudget = wi.budget;
                          const wiAllocated = parseFloat(wiBudget?.allocated_amount || 0);
                          const wiSpent = parseFloat(wiBudget?.spent_amount ?? wi.spent_amount ?? 0);
                          const wiHasBudget = wiAllocated > 0;
                          const wiPercent = wiHasBudget ? Math.round((wiSpent / wiAllocated) * 100) : null;
                          const wiOver = wiHasBudget && wiSpent > wiAllocated;

                          return (
                            <tr key={wi.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {wi.name}
                              </td>
                              <td style={{ padding: '14px' }}>
                                <StatusPill status={wi.work_status} />
                              </td>
                              <td style={{ padding: '14px', textAlign: 'right', color: wiHasBudget ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                                {wiHasBudget ? formatCurrency(wiAllocated, wiBudget?.currency || budgetCurrency) : 'N/A'}
                              </td>
                              <td style={{ padding: '14px', textAlign: 'right', fontWeight: 600, color: wiOver ? '#dc2626' : 'var(--text-primary)' }}>
                                {formatCurrency(wiSpent, wiBudget?.currency || budgetCurrency)}
                              </td>
                              <td style={{ padding: '14px', textAlign: 'right' }}>
                                {wiHasBudget ? (
                                  <span style={{ fontWeight: 600, color: wiOver ? '#dc2626' : wiPercent > 80 ? '#d97706' : '#16a34a' }}>
                                    {wiPercent}%
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-tertiary)' }}>N/A</span>
                                )}
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
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Itemized Expenditures</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                    Detailed log of all recorded expenditures on this plot
                  </p>
                </div>
                <ExpensesTable
                  expenses={expenses}
                  currency={budgetCurrency}
                  level="plot"
                  canDelete={canManageBudget}
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
        <DocumentList projectId={projectId} plotId={id} role={plot.role} />
      )}


      {/* Modals */}
      {showNewWorkItem && (
        <FormOverlay onClose={() => setShowNewWorkItem(false)}>
          <NewWorkItemForm
            projectId={projectId || plot?.construction_project?.id || plot?.construction_project}
            plotId={id}
            token={token}
            onSuccess={fetchAll}
            onClose={() => setShowNewWorkItem(false)}
          />
        </FormOverlay>
      )}

      <InviteModal
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
        onSuccess={fetchAll}
        type="plot"
        entityId={id}
        projectId={projectId}
        defaultRole="foreman"
        title="Invite Foreman"
      />

      {/* Budget Modal */}
      {showBudgetModal && (
        <BudgetModal
          isOpen={showBudgetModal}
          token={token}
          budgetUrl={`/plots/${id}/budget/`}
          currentBudget={activeBudget}
          entityName="Plot"
          onClose={() => setShowBudgetModal(false)}
          onSave={(data) => {
            if (data) setBudget(data);
            fetchAll();
          }}
        />
      )}

      <Modal isOpen={showWorkHelp} onClose={() => setShowWorkHelp(false)} title="What is a Work Item?">
        <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          <strong>Works</strong> (or Work Items) represent major activities, tasks, or components that need to be completed within a Plot.
        </p>
        <p style={{ marginTop: '16px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          <strong>Example:</strong> "Foundation Laying", "Roofing", "Electrical First Fix", or "Plumbing".
          <br /><br />
          Inside a Work Item, you create Job Items (the day-to-day tasks).
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

export default PlotDetailPage;
