import React, { useState, useEffect } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import Modal from './Modal';

const formatCurrency = (amount, currency = 'NGN') => {
  if (!amount && amount !== 0) return '—';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency || 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
};

const CompleteJobModal = ({ isOpen, onClose, onComplete, itemType, itemName, expenses }) => {
  const [step, setStep] = useState(1);
  const [confirmName, setConfirmName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setConfirmName('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const totalExpense = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  const defaultCurrency = expenses.length > 0 ? expenses[0].currency : 'NGN';

  const handleContinue = () => {
    setStep(2);
  };

  const handleConfirm = () => {
    if (confirmName === itemName) {
      onComplete();
    }
  };

  const canConfirm = confirmName === itemName;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Mark ${itemType} as Completed`}>
      <div style={{ padding: '24px' }}>
        {step === 1 && (
          <div>
            <div style={{
              background: 'rgba(234,179,8,0.1)',
              border: '1px solid rgba(234,179,8,0.2)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px',
              display: 'flex',
              gap: '12px'
            }}>
              <AlertTriangle size={20} color="#eab308" style={{ flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                <strong>Warning:</strong> Once this {itemType.toLowerCase()} is marked as completed, you will not be able to add or update any expenses. Please review the expenses below before continuing.
              </p>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Expense Summary</h3>
            <div style={{
              background: 'var(--bg-raised)',
              borderRadius: '12px',
              maxHeight: '250px',
              overflowY: 'auto',
              marginBottom: '24px',
              border: '1px solid var(--border-default)'
            }}>
              {expenses.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  No expenses recorded for this {itemType.toLowerCase()}.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-default)', textAlign: 'left' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)' }}>Description</th>
                      <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)' }}>Code</th>
                      <th style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(exp => (
                      <tr key={exp.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                        <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>{exp.description}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{exp.cost_code_detail?.code || exp.cost_code}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>
                          {formatCurrency(exp.amount, exp.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="2" style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Total:</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right', color: 'var(--brand-orange)' }}>
                        {formatCurrency(totalExpense, defaultCurrency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-primary" onClick={handleContinue} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <p style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--text-secondary)' }}>
                To confirm completion, please type the exact name of the {itemType.toLowerCase()}:
              </p>
              <div style={{
                background: 'var(--bg-raised)',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontFamily: 'monospace',
                fontSize: '14px',
                fontWeight: 600,
                textAlign: 'center',
                letterSpacing: '0.5px'
              }}>
                {itemName}
              </div>
              <input
                type="text"
                className="input-field"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={itemName}
                style={{ width: '100%' }}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn-ghost" onClick={() => setStep(1)}>Back</button>
              <button 
                className="btn-primary" 
                onClick={handleConfirm}
                disabled={!canConfirm}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  background: canConfirm ? '#2d5a27' : 'var(--bg-raised)',
                  borderColor: canConfirm ? '#2d5a27' : 'var(--border-default)',
                  color: canConfirm ? '#fff' : 'var(--text-tertiary)'
                }}
              >
                <CheckCircle2 size={16} /> Confirm Complete
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default CompleteJobModal;
