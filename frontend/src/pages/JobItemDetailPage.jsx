import React, { useState, useEffect } from 'react';
// Optimized Job Item Detail View
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Image as ImageIcon, ArrowLeft, CheckCircle2, Loader as SpinnerIcon, X, DollarSign, Edit2, Trash2, Receipt } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch, unwrapList } from '../api/client';
import { Breadcrumb, Avatar, MaterialsEditor, Spinner, CommentsSection } from '../components';
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
const ExpenseModal = ({ onClose, onSave, existing, jobItemId, token }) => {
  const [form, setForm] = useState({
    amount: existing?.amount || '',
    description: existing?.description || '',
    currency: existing?.currency || 'NGN',
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
        const data = await res.json();
        setError(Object.values(data).flat().join(', '));
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Amount *</label>
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
              <label style={labelStyle}>Currency</label>
              <select
                value={form.currency}
                onChange={e => setForm({ ...form, currency: e.target.value })}
                style={inputStyle}
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Date *</label>
              <input
                type="date"
                required
                value={form.incurred_at}
                onChange={e => setForm({ ...form, incurred_at: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Category</label>
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
            <label style={labelStyle}>Description</label>
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
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const [highlightReportId, setHighlightReportId] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

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
          apiFetch(`/projects/${pid}/`, { token }),
          apiFetch(`/projects/${pid}/plots/${plid}/`, { token }),
          apiFetch(`/projects/${pid}/plots/${plid}/workitems/${wiid}/`, { token }),
          apiFetch(`/projects/${pid}/plots/${plid}/workitems/${wiid}/jobitems/${id}/reports/`, { token }),
          apiFetch(`/jobitems/${id}/expenses/`, { token }),
        ]);
        if (projRes.ok) setProject(await projRes.json());
        if (plotRes.ok) setPlot(await plotRes.json());
        if (wiRes.ok) setWorkItem(await wiRes.json());
        if (repRes.ok) setReports(unwrapList(await repRes.json()));
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

  const handleDeleteExpense = async (expId) => {
    if (!window.confirm('Delete this expense?')) return;
    const res = await apiFetch(`/jobitems/${id}/expenses/${expId}/`, { method: 'DELETE', token });
    if (res.ok) { showSuccessMessage('Expense deleted.'); fetchExpenses(); }
  };

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const rid = q.get('report');
    if (rid) setHighlightReportId(rid);
  }, [location.search]);

  useEffect(() => {
    if (!highlightReportId) return;
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

  const handleMarkComplete = async () => {
    if (!window.confirm("Mark this job as completed?")) return;
    try {
      const res = await apiFetch(`/jobitems/${id}/`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ job_status: 'Completed', actual_end_date: new Date().toISOString().split('T')[0] })
      });
      if (res.ok) {
        showSuccessMessage("Job marked as completed! 🏗️");
        fetchAll();
      }
    } catch (err) { console.error(err); }
  };

  if (loading) return <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}><Spinner /></div>;
  if (!jobItem) return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Job item not found.</div>;

  const materials = jobItem.material_requirements || [];
  const totalSpent = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const hasBudget = budget && parseFloat(budget.allocated_amount) > 0;
  const budgetCurrency = budget?.currency || 'NGN';
  const isOverBudget = hasBudget && totalSpent > parseFloat(budget.allocated_amount);

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
            {expenses.length > 0 && (
              <span style={{
                fontSize: '13px',
                padding: '5px 14px',
                borderRadius: '100px',
                background: isOverBudget ? 'rgba(220,38,38,0.1)' : 'rgba(34,197,94,0.1)',
                color: isOverBudget ? '#dc2626' : '#16a34a',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}>
                <DollarSign size={13} />
                {hasBudget
                  ? `${formatCurrency(totalSpent, budgetCurrency)} / ${formatCurrency(budget.allocated_amount, budgetCurrency)}`
                  : `Spent: ${formatCurrency(totalSpent, budgetCurrency)}`
                }
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {jobItem.job_status !== 'Completed' && (
            <button className="btn-ghost" onClick={handleMarkComplete} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} /> Mark Complete
            </button>
          )}
          <button
            className="btn-ghost"
            onClick={() => { setEditingExpense(null); setShowExpenseModal(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={15} /> Add Expense
          </button>
          <button className="btn-primary" onClick={() => navigate(`/job-items/${id}/reports/new`)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={15} /> Write Report
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Description */}
          {jobItem.job_description && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 12px' }}>Scope of Work</p>
              <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--text-secondary)', fontSize: '15px' }}>{jobItem.job_description}</p>
            </div>
          )}

          {/* Dates & Hours */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 6px' }}>Projected Start</p>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{jobItem.projected_start_date}</p>
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 6px' }}>Projected End</p>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{jobItem.projected_end_date}</p>
            </div>
            {jobItem.actual_start_date && <div>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 6px' }}>Actual Start</p>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{jobItem.actual_start_date}</p>
            </div>}
            {jobItem.estimated_hours && <div>
              <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 6px' }}>Est. Hours</p>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '20px', color: 'var(--brand-orange)' }}>{jobItem.estimated_hours}<span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-tertiary)' }}>h</span></p>
            </div>}
            {/* Budget stat */}
            {hasBudget && (
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 6px' }}>Budget</p>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: isOverBudget ? '#dc2626' : 'var(--brand-orange)' }}>
                  {formatCurrency(budget.allocated_amount, budgetCurrency)}
                </p>
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

          {/* ── Expenses Panel ── */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: '0 0 4px' }}>
                  Expenses ({expenses.length})
                </p>
                {expenses.length > 0 && (
                  <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: isOverBudget ? '#dc2626' : 'var(--brand-orange)' }}>
                    {formatCurrency(totalSpent, budgetCurrency)}
                    {hasBudget && (
                      <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: '6px' }}>
                        / {formatCurrency(budget.allocated_amount, budgetCurrency)}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <button
                className="btn-ghost"
                onClick={() => { setEditingExpense(null); setShowExpenseModal(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 16px' }}
              >
                <Plus size={14} /> Add Expense
              </button>
            </div>

            {/* Budget progress bar */}
            {hasBudget && expenses.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ height: '6px', borderRadius: '6px', background: 'var(--bg-raised)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, (totalSpent / parseFloat(budget.allocated_amount)) * 100)}%`,
                    background: isOverBudget ? '#dc2626' : 'var(--brand-orange)',
                    borderRadius: '6px',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  <span>{Math.round((totalSpent / parseFloat(budget.allocated_amount)) * 100)}% used</span>
                  <span style={{ color: isOverBudget ? '#dc2626' : 'var(--text-tertiary)' }}>
                    {isOverBudget ? `Over by ${formatCurrency(totalSpent - parseFloat(budget.allocated_amount), budgetCurrency)}` : `${formatCurrency(budget.remaining_amount, budgetCurrency)} remaining`}
                  </span>
                </div>
              </div>
            )}

            {expenses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>
                <Receipt size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
                <p style={{ fontWeight: 600, fontSize: '14px', margin: '0 0 6px' }}>No expenses yet</p>
                <p style={{ fontSize: '13px', margin: '0 0 16px' }}>Track payments and costs for this job.</p>
                <button
                  className="btn-primary"
                  onClick={() => { setEditingExpense(null); setShowExpenseModal(true); }}
                  style={{ padding: '10px 24px' }}
                >
                  Add First Expense
                </button>
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
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={() => { setEditingExpense(exp); setShowExpenseModal(true); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}
                        title="Edit"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Daily Reports Timeline */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '20px', padding: '24px', position: 'sticky', top: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase', margin: 0 }}>Daily Reports ({reports.length})</p>
            <button className="btn-ghost" onClick={() => navigate(`/job-items/${id}/reports/new`)} style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Plus size={12} /> New
            </button>
          </div>

          {reports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)' }}>
              <p style={{ fontWeight: 600, fontSize: '14px' }}>No reports yet</p>
              <p style={{ fontSize: '13px', marginBottom: '16px' }}>Start logging daily progress.</p>
              <button className="btn-primary" onClick={() => navigate(`/job-items/${id}/reports/new`)} style={{ justifyContent: 'center', width: '100%' }}>Write First Report</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '500px', overflowY: 'auto' }}>
              {reports.map(r => (
                <div
                  id={`report-${r.id}`}
                  key={r.id}
                  onClick={() => setSelectedReport(r)}
                  style={{
                    padding: '16px',
                    background: 'var(--bg-raised)',
                    borderRadius: '14px',
                    position: 'relative',
                    paddingLeft: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-canvas)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-raised)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', width: '4px', height: '60%', background: 'var(--brand-orange)', borderRadius: '4px' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{r.report_date}</p>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--brand-orange)' }}>{r.percentage_job_progress}%</span>
                  </div>
                  {r.notes && <p style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r.notes}</p>}
                  {r.issues_encountered && <p style={{ margin: '0 0 6px', fontSize: '12px', color: 'var(--status-delayed)', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>⚠ {r.issues_encountered}</p>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <StatusPill status={r.priority} />
                    {r.images?.length > 0 && (
                      <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ImageIcon size={12} /> {r.images.length} photo{r.images.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Report Detail Modal */}
      {selectedReport && (
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
            <h2 style={{ fontSize: '28px', marginBottom: '6px', marginTop: 0 }}>
              Report Details
            </h2>
            <p style={{ color: 'var(--text-tertiary)', marginBottom: '24px' }}>
              {selectedReport.report_date}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
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
                  Notes
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
                  Report Photos
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                  {selectedReport.images.map(image => (
                    <div key={image.id} style={{ cursor: 'pointer' }} onClick={() => window.open(image.image, '_blank')}>
                      <img
                        src={image.image}
                        alt={image.caption || 'Report photo'}
                        style={{ width: '100%', height: '130px', objectFit: 'cover', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}
                      />
                      {image.caption && (
                        <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>{image.caption}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Section */}
            <CommentsSection
              reportId={selectedReport.id}
              projectId={projectId}
              plotId={plotId}
              workitemId={workItemId}
              jobitemId={id}
            />
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <ExpenseModal
          token={token}
          jobItemId={id}
          existing={editingExpense}
          onClose={() => { setShowExpenseModal(false); setEditingExpense(null); }}
          onSave={() => { setShowExpenseModal(false); setEditingExpense(null); fetchExpenses(); }}
        />
      )}
    </div>
  );
};

export default JobItemDetailPage;
