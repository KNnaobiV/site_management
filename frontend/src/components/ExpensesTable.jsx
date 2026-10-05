import React, { useState } from 'react';
import {
  Receipt,
  Search,
  Trash2,
  AlertTriangle,
  X,
  FileText,
  DollarSign,
  TrendingUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import Spinner from './Spinner';
import { apiFetch, formatApiError } from '../api/client';
import { showSuccessMessage } from '../utils/successMessage';

// Format currency
const formatCurrency = (amount, currency = 'NGN') => {
  try {
    const locale = currency === 'USD' ? 'en-US' : currency === 'GBP' ? 'en-GB' : 'en-NG';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toLocaleString()}`;
  }
};

// ─── Delete Expense with Reason Modal ───────────────────────────────────────
const DeleteExpenseWithReasonModal = ({ token, expense, onClose, onDeleted }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('A reason for deleting this expense is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Try flat endpoint first or jobitem nested endpoint
      const url = expense.job_item_id || expense.job_item
        ? `/jobitems/${expense.job_item_id || expense.job_item}/expenses/${expense.id}/?reason=${encodeURIComponent(trimmed)}`
        : `/expenses/${expense.id}/?reason=${encodeURIComponent(trimmed)}`;

      const res = await apiFetch(url, {
        method: 'DELETE',
        token,
        body: JSON.stringify({ reason: trimmed }),
      });

      if (res.ok || res.status === 204) {
        showSuccessMessage('Expense deleted successfully ✅');
        onDeleted();
        onClose();
      } else {
        const data = await res.json().catch(() => null);
        setError(formatApiError(data, 'Failed to delete expense'));
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3100,
        padding: '24px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-in"
        style={{
          background: 'var(--bg-card)',
          borderRadius: '24px',
          padding: '36px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
          }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(220,38,38,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={22} color="#dc2626" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Delete Expense</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-tertiary)' }}>
              This will remove the expense from reports and budgets
            </p>
          </div>
        </div>

        {/* Expense Info Card */}
        <div
          style={{
            background: 'var(--bg-raised)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(expense.amount, expense.currency)}
            </span>
            <span
              style={{
                fontSize: '12px',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'var(--bg-card)',
                fontWeight: 600,
                color: 'var(--text-secondary)',
              }}
            >
              {expense.cost_code_detail?.code || 'GENERAL'}
            </span>
          </div>
          {expense.description && (
            <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {expense.description}
            </p>
          )}
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
            Date: {expense.incurred_at}
          </p>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.5 }}>
          An expense once recorded cannot be deleted except by the Project Manager or Plot Creator with a documented reason:
        </p>

        {error && (
          <div
            style={{
              background: 'rgba(220,38,38,0.1)',
              border: '1px solid rgba(220,38,38,0.2)',
              borderRadius: '10px',
              padding: '10px 14px',
              color: '#dc2626',
              fontSize: '13px',
              marginBottom: '14px',
            }}
          >
            {error}
          </div>
        )}

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="State the reason for deleting this expense (required)..."
          rows={3}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-canvas)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            resize: 'none',
            outline: 'none',
            boxSizing: 'border-box',
            marginBottom: '20px',
          }}
        />

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            className="btn-ghost"
            onClick={onClose}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving || !reason.trim()}
            style={{
              flex: 1,
              padding: '10px 18px',
              borderRadius: '12px',
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: saving || !reason.trim() ? 'not-allowed' : 'pointer',
              opacity: saving || !reason.trim() ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {saving ? <Spinner size={16} /> : 'Delete Expense'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Expenses Table Component ──────────────────────────────────────────
const ExpensesTable = ({
  expenses = [],
  currency = 'NGN',
  level = 'project', // 'project' | 'plot' | 'workitem' | 'jobitem'
  canDelete = false,
  onExpenseDeleted,
  token,
  emptyMessage = 'No expenses recorded yet.',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingExpense, setDeletingExpense] = useState(null);
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  const totalSpent = expenses.reduce((acc, exp) => acc + parseFloat(exp.amount || 0), 0);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} style={{ opacity: 0.35, marginLeft: '5px', verticalAlign: 'middle' }} />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={12} style={{ color: 'var(--brand-orange)', marginLeft: '5px', verticalAlign: 'middle' }} />
    ) : (
      <ArrowDown size={12} style={{ color: 'var(--brand-orange)', marginLeft: '5px', verticalAlign: 'middle' }} />
    );
  };

  const filteredExpenses = expenses.filter((exp) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const desc = (exp.description || '').toLowerCase();
    const code = (exp.cost_code_detail?.code || exp.cost_code_code || '').toLowerCase();
    const job = (exp.job_item_name || '').toLowerCase();
    const work = (exp.work_item_name || '').toLowerCase();
    const plot = (exp.plot_name || '').toLowerCase();
    const artisan = (exp.artisan_name || '').toLowerCase();
    return (
      desc.includes(term) ||
      code.includes(term) ||
      job.includes(term) ||
      work.includes(term) ||
      plot.includes(term) ||
      artisan.includes(term)
    );
  });

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    let valA, valB;
    switch (sortField) {
      case 'date':
        valA = new Date(a.incurred_at || a.created_at || 0).getTime();
        valB = new Date(b.incurred_at || b.created_at || 0).getTime();
        break;
      case 'cost_code':
        valA = (a.cost_code_detail?.code || a.cost_code_code || '').toLowerCase();
        valB = (b.cost_code_detail?.code || b.cost_code_code || '').toLowerCase();
        break;
      case 'artisan':
        valA = (a.artisan_name || '').toLowerCase();
        valB = (b.artisan_name || '').toLowerCase();
        break;
      case 'plot':
        valA = (a.plot_name || '').toLowerCase();
        valB = (b.plot_name || '').toLowerCase();
        break;
      case 'amount':
        valA = parseFloat(a.amount || 0);
        valB = parseFloat(b.amount || 0);
        break;
      default:
        valA = a[sortField] || '';
        valB = b[sortField] || '';
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Stat Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              Total Expenses
            </span>
            <DollarSign size={16} color="var(--brand-orange)" />
          </div>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--brand-orange)' }}>
            {formatCurrency(totalSpent, currency)}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
            Aggregated spend across all items
          </p>
        </div>

        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              Total Records
            </span>
            <FileText size={16} color="var(--text-tertiary)" />
          </div>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {expenses.length}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
            Individual expense transactions
          </p>
        </div>

        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            padding: '20px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              Average / Item
            </span>
            <TrendingUp size={16} color="var(--text-tertiary)" />
          </div>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {expenses.length > 0
              ? formatCurrency(totalSpent / expenses.length, currency)
              : formatCurrency(0, currency)}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-tertiary)' }}>
            Per logged transaction
          </p>
        </div>
      </div>

      {/* Table Container Card */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '20px',
          padding: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '20px',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Expense Breakdown
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-tertiary)' }}>
              {filteredExpenses.length} of {expenses.length} expenses showing
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Sort Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Sort:</span>
              <select
                value={`${sortField}-${sortDirection}`}
                onChange={(e) => {
                  const [field, dir] = e.target.value.split('-');
                  setSortField(field);
                  setSortDirection(dir);
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-canvas)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="date-desc">Date (Newest)</option>
                <option value="date-asc">Date (Oldest)</option>
                <option value="cost_code-asc">Cost Code (A-Z)</option>
                <option value="cost_code-desc">Cost Code (Z-A)</option>
                <option value="artisan-asc">Artisan (A-Z)</option>
                <option value="artisan-desc">Artisan (Z-A)</option>
                {level === 'project' && <option value="plot-asc">Plot (A-Z)</option>}
                {level === 'project' && <option value="plot-desc">Plot (Z-A)</option>}
                <option value="amount-desc">Amount (Highest)</option>
                <option value="amount-asc">Amount (Lowest)</option>
              </select>
            </div>

            {/* Search bar */}
            <div
              style={{
                position: 'relative',
                minWidth: '220px',
              }}
            >
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                }}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search expenses..."
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 34px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-canvas)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>

        {sortedExpenses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-tertiary)' }}>
            <Receipt size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
            <p style={{ fontWeight: 600, fontSize: '14px', margin: '0 0 6px' }}>
              {searchTerm ? 'No matching expenses' : emptyMessage}
            </p>
            <p style={{ fontSize: '13px', margin: 0 }}>
<<<<<<< HEAD
              {searchTerm ? 'Try adjusting your search criteria.' : 'Expenses logged on job items will automatically show up here.'}
=======
              {searchTerm ? 'Try adjusting your search criteria.' : 'Expenses logged on jobs will automatically show up here.'}
>>>>>>> 71825ce3ef8944da52ab133cde6fbcb6410fd45c
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--text-tertiary)',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  <th
                    onClick={() => handleSort('date')}
                    style={{ padding: '12px 14px', cursor: 'pointer', userSelect: 'none' }}
                  >
                    Date {renderSortIcon('date')}
                  </th>
                  <th
                    onClick={() => handleSort('cost_code')}
                    style={{ padding: '12px 14px', cursor: 'pointer', userSelect: 'none' }}
                  >
                    Cost Code {renderSortIcon('cost_code')}
                  </th>
                  <th style={{ padding: '12px 14px' }}>Description</th>
                  <th
                    onClick={() => handleSort('artisan')}
                    style={{ padding: '12px 14px', cursor: 'pointer', userSelect: 'none' }}
                  >
                    Artisan {renderSortIcon('artisan')}
                  </th>
                  {level === 'project' ? (
                    <th
                      onClick={() => handleSort('plot')}
                      style={{ padding: '12px 14px', cursor: 'pointer', userSelect: 'none' }}
                    >
<<<<<<< HEAD
                      Plot / Work Item / Job Item {renderSortIcon('plot')}
                    </th>
                  ) : level === 'plot' ? (
                    <th style={{ padding: '12px 14px' }}>Work Item / Job Item</th>
                  ) : (
                    <th style={{ padding: '12px 14px' }}>Job Item</th>
=======
                      Plot / Work / Job {renderSortIcon('plot')}
                    </th>
                  ) : level === 'plot' ? (
                    <th style={{ padding: '12px 14px' }}>Work / Job</th>
                  ) : (
                    <th style={{ padding: '12px 14px' }}>Job</th>
>>>>>>> 71825ce3ef8944da52ab133cde6fbcb6410fd45c
                  )}
                  <th
                    onClick={() => handleSort('amount')}
                    style={{ padding: '12px 14px', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                  >
                    Amount {renderSortIcon('amount')}
                  </th>
                  {canDelete && <th style={{ padding: '12px 14px', textAlign: 'center', width: '50px' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {sortedExpenses.map((exp) => (
                  <tr
                    key={exp.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-raised)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td style={{ padding: '14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {exp.incurred_at || '—'}
                    </td>
                    <td style={{ padding: '14px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: 'rgba(249,115,22,0.1)',
                          color: 'var(--brand-orange)',
                          display: 'inline-block',
                        }}
                      >
                        {exp.cost_code_detail?.code || exp.cost_code_code || 'GENERAL'}
                      </span>
                    </td>
                    <td style={{ padding: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {exp.description || '—'}
                    </td>
                    <td
                      style={{
                        padding: '14px',
                        color: exp.artisan_name ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        fontWeight: exp.artisan_name ? 600 : 400,
                      }}
                    >
                      {exp.artisan_name || '—'}
                    </td>
                    <td style={{ padding: '14px', color: 'var(--text-secondary)' }}>
                      {level === 'project' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px' }}>
                            {exp.plot_name || (exp.plot_id ? `Plot #${exp.plot_id}` : 'Direct Project')}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                            {[exp.work_item_name, exp.job_item_name].filter(Boolean).join(' › ') || 'Direct Plot Expense'}
                          </span>
                        </div>
                      ) : level === 'plot' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
<<<<<<< HEAD
                            {exp.work_item_name || 'Work Item'}
=======
                            {exp.work_item_name || 'Work'}
>>>>>>> 71825ce3ef8944da52ab133cde6fbcb6410fd45c
                          </span>
                          {exp.job_item_name && (
                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                              {exp.job_item_name}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          {exp.job_item_name || '—'}
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: '14px',
                        textAlign: 'right',
                        fontWeight: 700,
                        fontSize: '14px',
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatCurrency(exp.amount, exp.currency || currency)}
                    </td>
                    {canDelete && (
                      <td style={{ padding: '14px', textAlign: 'center' }}>
                        <button
                          onClick={() => setDeletingExpense(exp)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-tertiary)',
                            padding: '6px',
                            borderRadius: '8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            transition: 'color 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#dc2626';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-tertiary)';
                          }}
                          title="Delete Expense"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {deletingExpense && (
        <DeleteExpenseWithReasonModal
          token={token}
          expense={deletingExpense}
          onClose={() => setDeletingExpense(null)}
          onDeleted={() => {
            if (onExpenseDeleted) onExpenseDeleted();
          }}
        />
      )}
    </div>
  );
};

export default ExpensesTable;
