import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

/**
 * MaterialsEditor — add/remove material requirement rows.
 * @param {Array} items - [{name, quantity, unit}]
 * @param {function} onChange - (items) => void
 * @param {boolean} readOnly - display mode without editing
 */
const MaterialsEditor = ({ items = [], onChange, readOnly = false }) => {
  const addRow = () => {
    onChange([...items, { name: '', quantity: '', unit: '' }]);
  };

  const update = (index, field, value) => {
    const next = items.map((row, i) => i === index ? { ...row, [field]: value } : row);
    onChange(next);
  };

  const removeRow = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const inputStyle = {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid var(--border-default)',
    background: 'var(--bg-raised)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    fontFamily: 'var(--font-sans)',
    width: '100%'
  };

  if (readOnly) {
    if (items.length === 0) return <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>No materials listed.</p>;
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
            {['Material', 'Quantity', 'Unit'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-tertiary)', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>{row.name}</td>
              <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{row.quantity}</td>
              <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{row.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {items.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 36px', gap: '8px', marginBottom: '2px' }}>
          {['Material name', 'Qty', 'Unit', ''].map((h, i) => (
            <span key={i} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0 4px' }}>{h}</span>
          ))}
        </div>
      )}

      {items.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 36px', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={row.name}
            onChange={e => update(i, 'name', e.target.value)}
            placeholder="e.g. Cement"
            style={inputStyle}
          />
          <input
            type="number"
            value={row.quantity}
            onChange={e => update(i, 'quantity', e.target.value)}
            placeholder="0"
            min="0"
            style={inputStyle}
          />
          <input
            type="text"
            value={row.unit}
            onChange={e => update(i, 'unit', e.target.value)}
            placeholder="bags, m², ft"
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => removeRow(i)}
            style={{
              background: 'none', border: 'none', padding: '6px',
              cursor: 'pointer', color: 'var(--text-tertiary)',
              borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--status-delayed)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'none', border: '1px dashed var(--border-default)',
          borderRadius: '10px', padding: '10px 14px',
          color: 'var(--text-tertiary)', cursor: 'pointer',
          fontSize: '14px', fontFamily: 'var(--font-sans)',
          transition: 'all 0.2s', marginTop: '4px'
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-orange)'; e.currentTarget.style.color = 'var(--brand-orange)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
      >
        <Plus size={15} />
        Add material
      </button>
    </div>
  );
};

export default MaterialsEditor;
