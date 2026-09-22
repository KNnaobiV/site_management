import React, { useState, useEffect } from 'react';
// Optimized Job Item Detail View
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Image as ImageIcon, ArrowLeft, CheckCircle2, Loader as SpinnerIcon, X, DollarSign, Edit2, Trash2, Receipt, Upload, Download, FileText, BarChart3, HelpCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList, formatApiError, getMediaUrl } from '../api/client';
import { Breadcrumb, Tabs, Avatar, MaterialsEditor, Spinner, CommentsSection, ImageUploader, CompleteJobModal, ReviewJobModal } from '../components';
import BudgetModal from '../components/BudgetModal';
import { showSuccessMessage } from '../utils/successMessage';

const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR'];

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

const inputStyle = { width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border-default)', background: 'var(--bg-raised)', color: 'var(--text-primary)', fontSize: '15px', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' };
const labelStyle = { display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', letterSpacing: '0.04em' };

// Currency formatter
const formatCurrency = (amount, currency = 'NGN') => {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toLocaleString()}`;
  }
};

// ─── Expense Modal ────────────────────────────────────────────────────────────
const ExpenseModal = ({ onClose, onSave, existing, jobItemId, token, defaultCurrency = 'NGN' }) => {
  const [form, setForm] = useState({
    amount: existing?.amount || '',
    description: existing?.description || '',
    currency: existing?.currency || defaultCurrency || 'NGN',
    incurred_at: existing?.incurred_at || new Date().toISOString().split('T')[0],
    cost_code_code: existing?.cost_code_detail?.code || 'GENERAL',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const url = existing
        ? `/jobitems/${jobItemId}/expenses/${existing.id}/`
        : `/jobitems/${jobItemId}/expenses/`;
      const method = existing ? 'PATCH' : 'POST';
      const res = await apiFetch(url, { method, token, body: JSON.stringify(form) });
      if (res.ok) {
        showSuccessMessage(existing ? 'Expense updated!' : 'Expense added! 💰');
        onSave();
      } else {
        const data = await res.json().catch(() => null);
        setError(formatApiError(data, 'Failed to save expense.'));
      }
    } catch {
      setError('Connection error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '24px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="fade-in"
        style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '36px', maxWidth: '500px', width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.2)', position: 'relative' }}
      >
        <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
          <X size={22} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #f97316, #ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Receipt size={20} color="white" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>{existing ? 'Edit Expense' : 'Add Expense'}</h2>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-tertiary)' }}>Record a payment or expense for this job</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Amount <span style={{ color: "var(--brand-orange)" }}>*</span></label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="0.00"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Currency <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
              <select
                value={form.currency}
                onChange={e => setForm({ ...form, currency: e.target.value })}
                style={inputStyle}
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Date <span style={{ color: "var(--brand-orange)" }}>*</span></label>
              <input
                type="date"
                required
                value={form.incurred_at}
                onChange={e => setForm({ ...form, incurred_at: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Category <span style={{ color: "var(--brand-orange)" }}>*</span></label>
              <select
                value={form.cost_code_code}
                onChange={e => setForm({ ...form, cost_code_code: e.target.value })}
                style={inputStyle}
              >
                {['GENERAL', 'LABOR', 'MATERIALS', 'EQUIPMENT', 'TRANSPORT', 'SUBCONTRACT', 'OVERHEAD'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Description <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
            <textarea
              placeholder="What was this expense for?"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
            />
          </div>

          {error && <p style={{ margin: 0, color: 'var(--status-delayed)', fontSize: '13px' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
            <button type="button" onClick={onClose} className="btn-ghost" style={{ flex: 1, padding: '14px' }}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 2, padding: '14px' }} disabled={saving}>
              {saving ? <Spinner size={18} /> : (existing ? 'Save Changes' : 'Add Expense')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Delete Expense Modal (Requires Reason) ──────────────────────────────────
const DeleteExpenseModal = ({ token, jobItemId, expense, onClose, onDeleted }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('A reason for deleting this expense is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/jobitems/${jobItemId}/expenses/${expense.id}/?reason=${encodeURIComponent(trimmed)}`,
        {
          method: 'DELETE',
          token,
          body: JSON.stringify({ reason: trimmed }),
        }
      );
      if (res.ok) {
        showSuccessMessage('Expense deleted successfully ✅');
        onDeleted();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(formatApiError(data, 'Failed to delete expense'));
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px',
    }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '24px',
        width: '100%', maxWidth: '480px',
        padding: '32px',
        boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '12px',
              background: 'rgba(220,38,38,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#dc2626',
            }}>
              <Trash2 size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Delete Expense</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{
          background: 'var(--bg-raised)',
          borderRadius: '14px',
          padding: '14px 16px',
          marginBottom: '18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>
              {formatCurrency(expense.amount, expense.currency)}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
              {expense.cost_code_detail?.code || 'GENERAL'} • {expense.incurred_at}
            </p>
          </div>
          {expense.description && (
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {expense.description}
            </span>
          )}
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.5 }}>
          An expense once made cannot be deleted except by the Project Manager or Plot Creator with a documented reason:
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Reason for Deletion <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
            <textarea
              autoFocus
              placeholder="e.g., Duplicate entry, mistaken payment, or wrong cost code..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-canvas)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {error && <p style={{ margin: 0, color: '#dc2626', fontSize: '13px' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
            <button type="button" onClick={onClose} className="btn-ghost" style={{ flex: 1, padding: '12px' }} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1,
                padding: '12px',
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {saving ? <Spinner size={16} /> : 'Delete Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const JobItemDetailPage = () => {
  const { projectId: pidFromUrl, plotId: plidFromUrl, workItemId: wiidFromUrl, jobItemId } = useParams();
  const id = jobItemId;
  const [projectId, setProjectId] = useState(pidFromUrl);
  const [plotId, setPlotId] = useState(plidFromUrl);
  const [workItemId, setWorkItemId] = useState(wiidFromUrl);
  const { token } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [plot, setPlot] = useState(null);
  const [workItem, setWorkItem] = useState(null);
  const [jobItem, setJobItem] = useState(null);
  const [reports, setReports] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [budget, setBudget] = useState(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const [highlightReportId, setHighlightReportId] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState(null);
  const [reportAttachFiles, setReportAttachFiles] = useState([]);
  const [uploadingReportPhotos, setUploadingReportPhotos] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [reportType, setReportType] = useState('job');
  const [exportingFinancial, setExportingFinancial] = useState(false);
  const [financialExportError, setFinancialExportError] = useState(null);

  const handleExportFinancialReport = async () => {
    setExportingFinancial(true);
    setFinancialExportError(null);
    try {
      const res = await apiFetch(`/jobitems/${id}/export-financial-report/`, { token });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || 'Unable to export financial report.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `jobitem_${id}_financial_report_${new Date().toISOString().split('T')[0]}.pdf`;
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

  const handleUploadReportPhotos = async (files) => {
    if (!files || !files.length || !selectedReport) return;
    setUploadingReportPhotos(true);
    try {
      const pid = projectId || jobItem?.construction_project;
      const plid = plotId || jobItem?.construction_plot;
      const wiid = workItemId || jobItem?.work_item;
      for (const file of files) {
        const fd = new FormData();
        fd.append('image', file);
        await apiFetch(`/projects/${pid}/plots/${plid}/workitems/${wiid}/jobitems/${id}/reports/${selectedReport.id}/images/`, {
          method: 'POST',
          token,
          body: fd
        });
      }
      showSuccessMessage("Photos uploaded to report successfully ✅");
      setReportAttachFiles([]);
      // Refresh reports list using flat endpoint
      const repRes = await apiFetch(`/jobitems/${id}/reports/`, { token });
      if (repRes.ok) {
        const list = unwrapList(await repRes.json());
        setReports(list);
        const updatedSelected = list.find(r => r.id === selectedReport.id);
        if (updatedSelected) setSelectedReport(updatedSelected);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingReportPhotos(false);
    }
  };

  const handleDeleteReportPhoto = async (photoId) => {
    if (!window.confirm("Are you sure you want to delete this photo from the report?")) return;
    try {
      const pid = projectId || jobItem?.construction_project;
      const plid = plotId || jobItem?.construction_plot;
      const wiid = workItemId || jobItem?.work_item;
      const res = await apiFetch(`/projects/${pid}/plots/${plid}/workitems/${wiid}/jobitems/${id}/reports/${selectedReport.id}/images/${photoId}/`, {
        method: 'DELETE',
        token,
      });
      if (res.ok) {
        showSuccessMessage("Photo deleted from report ✅");
        const repRes = await apiFetch(`/jobitems/${id}/reports/`, { token });
        if (repRes.ok) {
          const list = unwrapList(await repRes.json());
          setReports(list);
          const updatedSelected = list.find(r => r.id === selectedReport.id);
          if (updatedSelected) setSelectedReport(updatedSelected);
        }
      } else {
        alert("Failed to delete photo");
      }
    } catch (err) {
      console.error("Error deleting report photo:", err);
    }
  };

  useEffect(() => { fetchAll(); }, [projectId, plotId, workItemId, id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const jiRes = await apiFetch(`/jobitems/${id}/`, { token });
      if (jiRes.ok) {
        const jiData = await jiRes.json();
        setJobItem(jiData);
        setBudget(jiData.budget || null);

        const pid = pidFromUrl || jiData.construction_project;
        const plid = plidFromUrl || jiData.construction_plot;
        const wiid = wiidFromUrl || jiData.work_item;

        setProjectId(pid);
        setPlotId(plid);
        setWorkItemId(wiid);

        const [projRes, plotRes, wiRes, repRes, expRes] = await Promise.all([
          pid ? apiFetch(`/projects/${pid}/`, { token }) : Promise.resolve({ ok: false }),
          (pid && plid) ? apiFetch(`/projects/${pid}/plots/${plid}/`, { token }) : Promise.resolve({ ok: false }),
          (pid && plid && wiid) ? apiFetch(`/projects/${pid}/plots/${plid}/workitems/${wiid}/`, { token }) : Promise.resolve({ ok: false }),
          apiFetch(`/jobitems/${id}/reports/`, { token }),
          apiFetch(`/jobitems/${id}/expenses/`, { token }),
        ]);
        if (projRes.ok) setProject(await projRes.json());
        if (plotRes.ok) setPlot(await plotRes.json());
        if (wiRes.ok) setWorkItem(await wiRes.json());
        
        let reportList = [];
        if (repRes.ok) {
          reportList = unwrapList(await repRes.json());
        } else if (pid && plid && wiid) {
          const fallbackRes = await apiFetch(`/projects/${pid}/plots/${plid}/workitems/${wiid}/jobitems/${id}/reports/`, { token });
          if (fallbackRes.ok) reportList = unwrapList(await fallbackRes.json());
        }
        setReports(reportList);

        if (expRes.ok) setExpenses(unwrapList(await expRes.json()));
      }
    } catch (e) {
      console.error("JobItemDetailPage fetch error:", e);
    } finally { setLoading(false); }
  };

  const fetchExpenses = async () => {
    try {
      const res = await apiFetch(`/jobitems/${id}/expenses/`, { token });
      if (res.ok) setExpenses(unwrapList(await res.json()));
      // Refresh budget from job item
      const jiRes = await apiFetch(`/jobitems/${id}/`, { token });
      if (jiRes.ok) { const jiData = await jiRes.json(); setBudget(jiData.budget || null); }
    } catch (e) { console.error(e); }
  };

  const canDeleteExpense = (
    plot?.role === 'owner' ||
    plot?.role === 'project_manager' ||
    project?.role === 'owner' ||
    project?.role === 'project_manager'
  );

  // Only PM, creator (owner), and foreman can add/edit expenses
  const canAddExpense = (
    plot?.role === 'owner' ||
    plot?.role === 'project_manager' ||
    plot?.role === 'foreman' ||
    project?.role === 'owner' ||
    project?.role === 'project_manager'
  );

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const rid = q.get('report');
    if (rid) setHighlightReportId(rid);
  }, [location.search]);

  useEffect(() => {
    if (!highlightReportId || !reports.length) return;
    const match = reports.find(r => String(r.id) === String(highlightReportId));
    if (match) setSelectedReport(match);
    setTimeout(() => {
      const el = document.getElementById(`report-${highlightReportId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const prevBg = el.style.boxShadow;
        el.style.boxShadow = '0 6px 30px rgba(66,153,225,0.18)';
        el.style.transition = 'box-shadow 300ms ease-in-out';
        setTimeout(() => { el.style.boxShadow = prevBg || 'none'; }, 3000);
      }
    }, 350);
  }, [reports, highlightReportId]);

  const handleMarkComplete = () => {
    setShowCompleteModal(true);
  };

  const submitCompletion = async () => {
    try {
      const res = await apiFetch(`/jobitems/${id}/`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ job_status: 'Completed', actual_end_date: new Date().toISOString().split('T')[0] })
      });
      if (res.ok) {
        showSuccessMessage("Job marked as completed! 🏗️");
        setShowCompleteModal(false);
        fetchAll();
      } else {
        const d = await res.json().catch(() => null);
        alert(formatApiError(d, "Failed to mark job as completed."));
      }
    } catch (err) { console.error(err); }
  };

  const handleReview = async (actionType, message) => {
    try {
      const endpoint = actionType === 'approve' ? 'approve' : 'reject';
      const res = await apiFetch(`/projects/${projectId}/plots/${plotId}/workitems/${workItemId}/jobitems/${id}/${endpoint}/`, {
        method: 'POST',
        token,
        body: JSON.stringify({ message })
      });
      if (res.ok) {
        showSuccessMessage(`Job ${actionType === 'approve' ? 'approved' : 'rejected'} successfully.`);
        setShowReviewModal(false);
        fetchAll();
      } else {
        const d = await res.json().catch(() => null);
        alert(formatApiError(d, `Failed to ${actionType} job.`));
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteReport = async (reportId) => {
    if (!canDeleteReport) {
      alert("Only the project manager or project creator can delete a report.");
      return;
    }
    const expectedName = jobItem?.job_name || '';
    const inputName = window.prompt(`To delete this report, type the exact job item name "${expectedName}":`);
    if (inputName === null) return;
    if (inputName.trim() !== expectedName.trim()) {
      alert(`Job item name does not match "${expectedName}". Deletion cancelled.`);
      return;
    }

    try {
      const url = `/projects/${projectId}/plots/${plotId}/workitems/${workItemId}/jobitems/${id}/reports/${reportId}/?job_name=${encodeURIComponent(inputName.trim())}`;
      const res = await apiFetch(url, {
        method: 'DELETE',
        token,
        body: JSON.stringify({ job_name: inputName.trim() })
      });
      if (res.ok) {
        showSuccessMessage("Daily report deleted.");
        setSelectedReport(null);
        fetchAll();
      } else {
        const d = await res.json().catch(() => null);
        alert(formatApiError(d, "Failed to delete report."));
      }
    } catch (e) { console.error(e); }
  };

  if (loading) return <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}><Spinner /></div>;
  if (!jobItem) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Job not found.</div>;

  const materials = jobItem.material_requirements || [];
  const totalSpent = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const hasBudget = budget && parseFloat(budget.allocated_amount) > 0;
  const percentageSpent = hasBudget ? Math.round((totalSpent / parseFloat(budget.allocated_amount)) * 100) : null;
  const budgetCurrency = budget?.currency || 'NGN';
  const isOverBudget = hasBudget && totalSpent > parseFloat(budget.allocated_amount);

  const canViewFinance =
    plot?.role === 'owner' ||
    plot?.role === 'project_manager' ||
    project?.role === 'owner' ||
    project?.role === 'project_manager';

  const canViewReports =
    plot?.role === 'owner' ||
    plot?.role === 'project_manager' ||
    plot?.role === 'foreman' ||
    plot?.role === 'consultant' ||
    project?.role === 'owner' ||
    project?.role === 'project_manager' ||
    project?.role === 'consultant';

  const canViewInternalComments =
    plot?.role === 'owner' ||
    plot?.role === 'project_manager' ||
    plot?.role === 'foreman' ||
    project?.role === 'owner' ||
    project?.role === 'project_manager';

  const canManageBudget = canViewFinance;
  const hasFinanceAccess = canViewFinance;

  const canApprove = (
    plot?.role === 'owner' ||
    plot?.role === 'project_manager' ||
    project?.role === 'owner' ||
    project?.role === 'project_manager'
  );

  const canComplete = canApprove;
  const canDeleteReport = canApprove;


  return (
    <div className="fade-up" style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 0 60px' }}>
      <Breadcrumb items={[
        { label: 'Projects', to: '/projects' },
        { label: project?.project_name || '...', to: `/projects/${projectId}` },
        { label: plot?.address || '...', to: `/plots/${plotId}` },
        { label: workItem?.name || '...', to: `/work-items/${workItemId}` },
        { label: jobItem.job_name },
      ]} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '32px', marginTop: '12px' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(24px,4vw,42px)', marginBottom: '10px', lineHeight: 1.05 }}>{jobItem.job_name}</h1>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <StatusPill status={jobItem.job_status} />
            <span style={{ fontSize: '14px', color: 'var(--text-tertiary)', padding: '5px 14px', borderRadius: '100px', background: 'var(--bg-raised)', fontWeight: 500 }}>{jobItem.job_artisan}</span>
            {/* Spend badge */}
            {hasFinanceAccess && (
              <span style={{
                fontSize: '13px',
                padding: '5px 14px',
                borderRadius: '100px',
                background: hasBudget
                  ? (isOverBudget ? 'rgba(220,38,38,0.1)' : 'rgba(34,197,94,0.1)')
                  : 'var(--bg-raised)',
                color: hasBudget
                  ? (isOverBudget ? '#dc2626' : '#16a34a')
                  : 'var(--text-secondary)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}>
                <DollarSign size={13} />
                {hasBudget
                  ? `${formatCurrency(totalSpent, budgetCurrency)} / ${formatCurrency(budget.allocated_amount, budgetCurrency)} (${percentageSpent}%)`
                  : `Spent: ${formatCurrency(totalSpent, budgetCurrency)} • Budget: N/A`
                }
              </span>
            )}
          </div>
        </div >
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {hasFinanceAccess && (
            <button className="btn-ghost" onClick={() => navigate(`/job-items/${id}/edit`)}>
              <Edit2 size={16} /> Edit Job
            </button>
          )}
          {canApprove && !jobItem.is_approved && (
            <button className="btn-ghost" onClick={() => setShowReviewModal(true)} style={{ color: '#2d5a27', borderColor: '#2d5a27' }}>
              <CheckCircle2 size={16} /> Review Job
            </button>
          )}
          {canComplete && jobItem.job_status !== 'Completed' && Number(jobItem.progress ?? 0) >= 100 && (
            <button className="btn-ghost" onClick={handleMarkComplete}>
              <CheckCircle2 size={16} /> Mark Complete
            </button>
          )}
          {canAddExpense && jobItem.job_status !== 'Completed' && (
            <button
              className="btn-ghost"
              onClick={() => { setEditingExpense(null); setShowExpenseModal(true); }}
            >
              <Plus size={16} /> Add Expense
            </button>
          )}
          {hasFinanceAccess && (
            <button className="btn-primary" onClick={() => navigate(`/job-items/${id}/reports/new`)}>
              <Plus size={16} /> Write Report
            </button>
          )}
        </div>
      </div >

      {/* Tabs Navigation */}
      {(() => {
        const tabs = [
          { id: 'overview', label: 'Overview' },
          ...(canViewFinance ? [{ id: 'finance', label: 'Finance' }] : []),
          ...(canViewReports ? [{ id: 'reports', label: `Reports (${reports.length})` }] : []),
        ];
        return <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} style={{ marginBottom: '36px', marginTop: '24px' }} />;
      })()}

      {/* ─── Overview Tab ─── */}
      {activeTab === 'overview' && (
        <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Scope of Work */}
            {jobItem.job_description && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 12px' }}>Scope of Work</p>
                <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--text-secondary)', fontSize: '15px' }}>{jobItem.job_description}</p>
              </div>
            )}

            {/* Dates & Hours */}
            <div className="mobile-grid-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 6px' }}>Start Date</p>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{jobItem.start_date || 'Not set'}</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 6px' }}>Target End Date</p>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{jobItem.target_end_date || 'Not set'}</p>
              </div>
              {jobItem.actual_start_date && (
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 6px' }}>Actual Start</p>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{jobItem.actual_start_date}</p>
                </div>
              )}
              {jobItem.actual_end_date && (
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 6px' }}>Actual End</p>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{jobItem.actual_end_date}</p>
                </div>
              )}
              {jobItem.estimated_hours && (
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 6px' }}>Est. Hours</p>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '20px', color: 'var(--brand-orange)' }}>{jobItem.estimated_hours}<span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-tertiary)' }}>h</span></p>
                </div>
              )}
            </div>

            {/* Materials */}
            {materials.length > 0 && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 16px' }}>Material Requirements</p>
                <MaterialsEditor items={materials} onChange={() => { }} readOnly />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 16px' }}>Job Assignment</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(249,115,22,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--brand-orange)' }}>
                  {jobItem.job_artisan?.[0] || 'A'}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{jobItem.job_artisan}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Assigned Artisan</p>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Status</span>
                  <StatusPill status={jobItem.job_status} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Priority</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{jobItem.priority || 'Medium'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Progress</span>
                  <span style={{ fontWeight: 700, color: 'var(--brand-orange)' }}>{jobItem.progress ?? 0}%</span>
                </div>
              </div>
            </div>

            {/* Financial Summary card if user has access */}
            {hasFinanceAccess && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0 }}>Financial Summary</p>
                  <button className="btn-ghost" onClick={() => setActiveTab('finance')} style={{ fontSize: '12px', padding: '4px 10px', color: 'var(--brand-orange)' }}>View Finance →</button>
                </div>
                <p style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700, color: isOverBudget ? '#dc2626' : 'var(--brand-orange)' }}>
                  {formatCurrency(totalSpent, budgetCurrency)}
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  {hasBudget ? `Budget: ${formatCurrency(budget.allocated_amount, budgetCurrency)} (${percentageSpent}%)` : 'No budget set'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Finance Tab ─── */}
      {canViewFinance && activeTab === 'finance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Allocated Budget</span>
              <p style={{ margin: '8px 0 0', fontSize: '24px', fontWeight: 700, color: hasBudget ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                {hasBudget ? formatCurrency(budget.allocated_amount, budgetCurrency) : 'N/A'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                {hasBudget ? 'Target limit for this job' : 'No budget set yet'}
              </p>
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Total Spent</span>
              <p style={{ margin: '8px 0 0', fontSize: '24px', fontWeight: 700, color: isOverBudget ? '#dc2626' : 'var(--brand-orange)' }}>
                {formatCurrency(totalSpent, budgetCurrency)}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                Itemized expense total
              </p>
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Remaining Budget</span>
              <p style={{ margin: '8px 0 0', fontSize: '24px', fontWeight: 700, color: hasBudget ? (isOverBudget ? '#dc2626' : 'var(--text-primary)') : 'var(--text-tertiary)' }}>
                {hasBudget
                  ? (isOverBudget
                    ? `Over by ${formatCurrency(totalSpent - parseFloat(budget.allocated_amount), budgetCurrency)}`
                    : formatCurrency(budget.remaining_amount, budgetCurrency))
                  : 'N/A'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: isOverBudget ? '#dc2626' : 'var(--text-tertiary)' }}>
                {hasBudget ? (isOverBudget ? 'Exceeded allocation' : 'Available balance') : 'N/A'}
              </p>
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Budget Spent (%)</span>
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
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Job Budget Management</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                  {hasBudget
                    ? `Current allocation is ${formatCurrency(budget.allocated_amount, budgetCurrency)}.`
                    : 'Assign a budget to track expenses against limits for this job.'}
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
                <button
                  className="btn-ghost"
                  onClick={() => navigate(`/reports?type=financial&jobitem=${id}&granularity=jobitem`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <BarChart3 size={16} /> Open in Reports Hub
                </button>
                {canManageBudget && (
                  <button
                    className="btn-primary"
                    onClick={() => setShowBudgetModal(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <DollarSign size={16} /> {hasBudget ? 'Edit Budget' : 'Set Budget'}
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
                  <span>{isOverBudget ? 'Over Budget' : `${formatCurrency(budget.remaining_amount, budgetCurrency)} remaining`}</span>
                </div>
              </div>
            )}
          </div>

          {/* Expenses Panel */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                  Expenses ({expenses.length})
                </h3>
                {expenses.length > 0 && (
                  <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 700, color: isOverBudget ? '#dc2626' : 'var(--brand-orange)' }}>
                    {formatCurrency(totalSpent, budgetCurrency)}
                    {hasBudget && (
                      <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: '6px' }}>
                        / {formatCurrency(budget.allocated_amount, budgetCurrency)}
                      </span>
                    )}
                  </p>
                )}
              </div>
              {canAddExpense && jobItem.job_status !== 'Completed' && (
                <button
                  className="btn-primary"
                  onClick={() => { setEditingExpense(null); setShowExpenseModal(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={16} /> Add Expense
                </button>
              )}
            </div>

            {expenses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-tertiary)' }}>
                <Receipt size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
                <p style={{ fontWeight: 600, fontSize: '15px', margin: '0 0 6px' }}>No expenses recorded yet</p>
                <p style={{ fontSize: '13px', margin: '0 0 16px' }}>Track payments and costs incurred for this job.</p>
                {jobItem.job_status !== 'Completed' && canAddExpense && (
                  <button
                    className="btn-primary"
                    onClick={() => { setEditingExpense(null); setShowExpenseModal(true); }}
                    style={{ padding: '10px 24px' }}
                  >
                    Add First Expense
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {expenses.map(exp => (
                  <div
                    key={exp.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '14px 16px',
                      background: 'var(--bg-raised)',
                      borderRadius: '14px',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(234,88,12,0.1))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Receipt size={16} color="var(--brand-orange)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                          {formatCurrency(exp.amount, exp.currency)}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '100px',
                          background: 'var(--bg-canvas)',
                          color: 'var(--text-tertiary)',
                          fontWeight: 600,
                          letterSpacing: '0.04em',
                        }}>
                          {exp.cost_code_detail?.code || 'GENERAL'}
                        </span>
                      </div>
                      {exp.description && (
                        <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {exp.description}
                        </p>
                      )}
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>{exp.incurred_at}</p>
                    </div>
                    {jobItem.job_status !== 'Completed' && (
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        {canAddExpense && (
                          <button
                            onClick={() => { setEditingExpense(exp); setShowExpenseModal(true); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}
                            title="Edit"
                          >
                            <Edit2 size={15} />
                          </button>
                        )}
                        {canDeleteExpense && (
                          <button
                            onClick={() => setDeletingExpense(exp)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Reports Tab ─── */}
      {canViewReports && activeTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Sub-navigation toggle */}
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
                <FileText size={16} /> Daily Reports ({reports.length})
              </button>
              {canViewFinance && (
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
              )}
            </div>

            {reportType === 'job' && (
              <button className="btn-primary" onClick={() => navigate(`/job-items/${id}/reports/new`)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} /> Write Report
              </button>
            )}

            {reportType === 'financial' && (
              <button
                className="btn-primary"
                onClick={handleExportFinancialReport}
                disabled={exportingFinancial}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Download size={16} /> {exportingFinancial ? 'Generating PDF...' : 'Download Financial Report (PDF)'}
              </button>
            )}
          </div>

          {/* View 1: Daily Reports */}
          {reportType === 'job' && (
            <div>
              {reports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-tertiary)', background: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border-subtle)' }}>
                  <FileText size={40} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
                    <p style={{ fontWeight: 600, fontSize: '16px', margin: 0 }}>No reports logged yet</p>
                    <div title="Reports track daily progress, issues, and photos of this specific job." style={{ display: 'flex', alignItems: 'center', color: 'var(--brand-orange)', cursor: 'help' }}>
                      <HelpCircle size={16} />
                    </div>
                  </div>
                  <p style={{ fontSize: '14px', margin: '0 0 20px' }}>Start logging daily progress for this job.</p>
                  <button className="btn-primary" onClick={() => navigate(`/job-items/${id}/reports/new`)}>
                    Write First Report
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {reports.map(r => (
                    <div
                      id={`report-${r.id}`}
                      key={r.id}
                      onClick={() => setSelectedReport(r)}
                      style={{
                        padding: '20px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '18px',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--brand-orange)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>{r.report_date}</p>
                          {r.reported_by_username && (
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>By {r.reported_by_username}</p>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--brand-orange)' }}>{r.percentage_job_progress}% complete</span>
                          <StatusPill status={r.priority || 'Planned'} />
                        </div>
                      </div>
                      {r.notes && <p style={{ margin: '8px 0 6px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r.notes}</p>}
                      {r.issues_encountered && <p style={{ margin: '6px 0', fontSize: '13px', color: 'var(--status-delayed)', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>⚠ {r.issues_encountered}</p>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                        {r.images?.length > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                              <ImageIcon size={13} /> {r.images.length} photo{r.images.length > 1 ? 's' : ''}
                            </span>
                            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
                              {r.images.slice(0, 4).map(img => (
                                <img
                                  key={img.id}
                                  src={getMediaUrl(img.image || img.img)}
                                  alt="Report photo"
                                  style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-subtle)', background: 'var(--bg-canvas)' }}
                                />
                              ))}
                              {r.images.length > 4 && (
                                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                                  +{r.images.length - 4}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : <span />}
                        <span style={{ fontSize: '12px', color: 'var(--brand-orange)', fontWeight: 600 }}>View details & comments →</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* View 2: Financial Report */}
          {reportType === 'financial' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Financial Metric Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '18px', padding: '20px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 6px' }}>Allocated Budget</p>
                  <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {hasBudget ? formatCurrency(budget.allocated_amount, budgetCurrency) : 'Not Set'}
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
                    {hasBudget ? formatCurrency(budget.remaining_amount, budgetCurrency) : '—'}
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

              {/* Itemized Expenses Table */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Itemized Expenses Breakdown</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                    All expenditures recorded directly under this job
                  </p>
                </div>
                {expenses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-tertiary)' }}>
                    <p style={{ margin: 0, fontWeight: 500 }}>No expenses recorded for this job yet.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          <th style={{ padding: '12px 14px' }}>Date</th>
                          <th style={{ padding: '12px 14px' }}>Cost Code</th>
                          <th style={{ padding: '12px 14px' }}>Description</th>
                          <th style={{ padding: '12px 14px', textAlign: 'right' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((exp) => (
                          <tr
                            key={exp.id}
                            style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s ease' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-raised)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <td style={{ padding: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {exp.incurred_at}
                            </td>
                            <td style={{ padding: '14px' }}>
                              <span style={{
                                fontSize: '11px',
                                padding: '3px 8px',
                                borderRadius: '100px',
                                background: 'var(--bg-raised)',
                                color: 'var(--text-secondary)',
                                fontWeight: 600,
                              }}>
                                {exp.cost_code_detail?.code || 'GENERAL'}
                              </span>
                            </td>
                            <td style={{ padding: '14px', color: 'var(--text-secondary)' }}>
                              {exp.description || '—'}
                            </td>
                            <td style={{ padding: '14px', textAlign: 'right', fontWeight: 700, color: 'var(--brand-orange)' }}>
                              {formatCurrency(exp.amount, exp.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Report Detail Modal */}
      {
        selectedReport && (
          <div
            onClick={() => setSelectedReport(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              padding: '24px',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="fade-in"
              style={{
                background: 'var(--bg-card)',
                borderRadius: '24px',
                padding: '40px',
                maxWidth: '700px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.15)',
                position: 'relative',
              }}
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedReport(null)}
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-tertiary)',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
              >
                <X size={24} />
              </button>

              {/* Report Details */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: '28px', marginBottom: '6px', marginTop: 0 }}>
                    Report Details
                  </h2>
                  <p style={{ color: 'var(--text-tertiary)', marginBottom: '24px' }}>
                    {selectedReport.report_date}
                  </p>
                </div>
                {canDeleteReport && (
                  <button
                    onClick={() => handleDeleteReport(selectedReport.id)}
                    className="btn-ghost"
                    style={{ color: '#dc2626', borderColor: 'transparent', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', marginTop: '4px', marginRight: '32px' }}
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                )}
              </div>

              <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 8px' }}>
                    Progress
                  </p>
                  <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--brand-orange)', margin: 0 }}>
                    {selectedReport.percentage_job_progress}%
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 8px' }}>
                    Priority
                  </p>
                  <StatusPill status={selectedReport.priority} />
                </div>
              </div>

              {selectedReport.notes && (
                <div style={{ marginBottom: '24px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 8px' }}>
                    General Observations
                  </p>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                    {selectedReport.notes}
                  </p>
                </div>
              )}

              {selectedReport.issues_encountered && (
                <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#dc2626', textTransform: 'uppercase', margin: '0 0 8px' }}>
                    ⚠ Issues Encountered
                  </p>
                  <p style={{ fontSize: '13px', color: '#7f1d1d', margin: 0, lineHeight: 1.6 }}>
                    {selectedReport.issues_encountered}
                  </p>
                </div>
              )}

              {selectedReport.images?.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 12px' }}>
                    Report Photos ({selectedReport.images.length})
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
                    {selectedReport.images.map(image => {
                      const imgUrl = getMediaUrl(image.image || image.img);
                      return (
                        <div
                          key={image.id}
                          style={{
                            position: 'relative',
                            borderRadius: '16px',
                            overflow: 'hidden',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-raised)',
                          }}
                        >
                          <img
                            src={imgUrl}
                            alt={image.caption || 'Report photo'}
                            onClick={() => window.open(imgUrl, '_blank')}
                            style={{ width: '100%', height: '140px', objectFit: 'cover', cursor: 'pointer', display: 'block' }}
                          />
                          {(plot?.role === 'owner' || plot?.role === 'project_manager' || plot?.role === 'foreman') && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteReportPhoto(image.id);
                              }}
                              title="Delete photo"
                              style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                background: 'rgba(0, 0, 0, 0.65)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '50%',
                                width: '28px',
                                height: '28px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
                              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.65)'}
                            >
                              <Trash2 size={14} color="#fff" />
                            </button>
                          )}
                          {image.caption && (
                            <p style={{ margin: '6px 8px 8px', fontSize: '12px', color: 'var(--text-tertiary)' }}>{image.caption}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Attach Photos Section */}
              <div style={{ marginBottom: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 12px' }}>
                  Attach Photos
                </p>
                <ImageUploader
                  files={reportAttachFiles}
                  onChange={setReportAttachFiles}
                  label="Attach Photos"
                  max={6}
                  onUpload={handleUploadReportPhotos}
                  uploading={uploadingReportPhotos}
                  uploadButtonText="Upload"
                />
              </div>

              {/* Comments Section */}
              {canViewInternalComments && (
                <CommentsSection
                  reportId={selectedReport.id}
                  projectId={projectId}
                  plotId={plotId}
                  workitemId={workItemId}
                  jobitemId={id}
                />
              )}
            </div>
          </div>
        )
      }

      {/* Budget Modal */}
      {showBudgetModal && (
        <BudgetModal
          isOpen={showBudgetModal}
          token={token}
          budgetUrl={`/jobitems/${id}/budget/`}
          currentBudget={budget}
          entityName="Job"
          onClose={() => setShowBudgetModal(false)}
          onSave={(data) => {
            if (data) setBudget(data);
            fetchAll();
          }}
        />
      )}

      {/* Expense Modal */}
      {
        showExpenseModal && (
          <ExpenseModal
            token={token}
            jobItemId={id}
            existing={editingExpense}
            defaultCurrency={budgetCurrency}
            onClose={() => { setShowExpenseModal(false); setEditingExpense(null); }}
            onSave={() => { setShowExpenseModal(false); setEditingExpense(null); fetchExpenses(); }}
          />
        )
      }

      {/* Delete Expense Modal */}
      {
        deletingExpense && (
          <DeleteExpenseModal
            token={token}
            jobItemId={id}
            expense={deletingExpense}
            onClose={() => setDeletingExpense(null)}
            onDeleted={() => { setDeletingExpense(null); fetchExpenses(); }}
          />
        )
      }
      <CompleteJobModal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        onComplete={submitCompletion}
        itemType="Job"
        itemName={jobItem?.job_name || ''}
        expenses={expenses}
      />

      <ReviewJobModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onReview={handleReview}
        itemType="Job"
        itemName={jobItem?.job_name || ''}
      />
    </div >
  );
};

export default JobItemDetailPage;
