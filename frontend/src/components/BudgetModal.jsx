import React, { useState, useEffect } from 'react';
import { X, DollarSign } from 'lucide-react';
import Spinner from './Spinner';
import { apiFetch, formatApiError } from '../api/client';
import { showSuccessMessage } from '../utils/successMessage';

const CURRENCIES = [
  { code: 'NGN', label: 'NGN (₦) - Nigerian Naira' },
  { code: 'USD', label: 'USD ($) - US Dollar' },
  { code: 'GBP', label: 'GBP (£) - British Pound' },
  { code: 'EUR', label: 'EUR (€) - Euro' },
];

const BudgetModal = ({
  isOpen,
  onClose,
  onSave,
  budgetUrl,
  currentBudget,
  entityName = 'Item',
  token,
}) => {
  const [allocatedAmount, setAllocatedAmount] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const existingAmount = parseFloat(currentBudget?.allocated_amount || 0);
      setAllocatedAmount(existingAmount > 0 ? String(existingAmount) : '');
      setCurrency(currentBudget?.currency || 'NGN');
      setError(null);
    }
  }, [isOpen, currentBudget]);

  if (!isOpen) return null;

  const hasExisting = parseFloat(currentBudget?.allocated_amount || 0) > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsed = parseFloat(allocatedAmount);
    if (isNaN(parsed) || parsed < 0) {
      setError('Please enter a valid budget amount (0 or greater).');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        allocated_amount: parsed.toFixed(2),
        currency: currency || 'NGN',
      };

      const res = await apiFetch(budgetUrl, {
        method: 'PATCH',
        token,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        showSuccessMessage(hasExisting ? 'Budget updated successfully! 💰' : 'Budget set successfully! 🎯');
        if (onSave) onSave(data);
        onClose();
      } else {
        const errData = await res.json().catch(() => null);
        setError(formatApiError(errData, 'Failed to save budget.'));
      }
    } catch {
      setError('Connection error. Please try again.');
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
        zIndex: 3000,
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
          maxWidth: '460px',
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <DollarSign size={22} color="white" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
              {hasExisting ? `Edit ${entityName} Budget` : `Set ${entityName} Budget`}
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-tertiary)' }}>
              Define the allocated financial budget
            </p>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(220,38,38,0.1)',
              border: '1px solid rgba(220,38,38,0.2)',
              borderRadius: '12px',
              padding: '12px 16px',
              color: '#dc2626',
              fontSize: '13px',
              marginBottom: '20px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '8px',
              }}
            >Currency <span style={{ color: "var(--text-tertiary)", fontSize: "12px", fontWeight: "normal" }}>(Optional)</span></label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-canvas)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
              }}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '8px',
              }}
            >Allocated Budget Amount <span style={{ color: "var(--brand-orange)" }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={allocatedAmount}
                onChange={(e) => setAllocatedAmount(e.target.value)}
                placeholder="e.g. 500000"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-canvas)',
                  color: 'var(--text-primary)',
                  fontSize: '16px',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={onClose}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              {saving ? <Spinner size={16} /> : hasExisting ? 'Update Budget' : 'Set Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BudgetModal;
