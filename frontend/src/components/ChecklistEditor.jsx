import React from 'react';
import { Plus, Trash2, Check } from 'lucide-react';

/**
 * ChecklistEditor — add/remove/toggle checklist items.
 * @param {Array} items - [{text, done}]
 * @param {function} onChange - (items) => void
 * @param {boolean} readOnly - show without editing capability
 */
const ChecklistEditor = ({ items = [], onChange, readOnly = false }) => {
  const addItem = () => {
    onChange([...items, { text: '', done: false }]);
  };

  const updateText = (index, text) => {
    const next = items.map((item, i) => i === index ? { ...item, text } : item);
    onChange(next);
  };

  const toggleDone = (index) => {
    const next = items.map((item, i) => i === index ? { ...item, done: !item.done } : item);
    onChange(next);
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Checkbox */}
          <button
            type="button"
            onClick={() => !readOnly && toggleDone(i)}
            style={{
              width: '22px', height: '22px', flexShrink: 0,
              borderRadius: '6px',
              border: item.done ? 'none' : '2px solid var(--border-strong)',
              background: item.done ? 'var(--brand-orange)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: readOnly ? 'default' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {item.done && <Check size={13} color="#fff" strokeWidth={3} />}
          </button>

          {readOnly ? (
            <span style={{
              flex: 1, fontSize: '15px',
              color: item.done ? 'var(--text-tertiary)' : 'var(--text-primary)',
              textDecoration: item.done ? 'line-through' : 'none'
            }}>
              {item.text || '—'}
            </span>
          ) : (
            <input
              type="text"
              value={item.text}
              onChange={e => updateText(i, e.target.value)}
              placeholder="Checklist item..."
              style={{
                flex: 1, padding: '10px 14px', borderRadius: '10px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-raised)',
                color: 'var(--text-primary)', fontSize: '14px',
                textDecoration: item.done ? 'line-through' : 'none',
                opacity: item.done ? 0.6 : 1,
              }}
            />
          )}

          {!readOnly && (
            <button
              type="button"
              onClick={() => removeItem(i)}
              style={{
                background: 'none', border: 'none', padding: '4px', cursor: 'pointer',
                color: 'var(--text-tertiary)', borderRadius: '6px',
                display: 'flex', alignItems: 'center'
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--status-delayed)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ))}

      {!readOnly && (
        <button
          type="button"
          onClick={addItem}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'none', border: '1px dashed var(--border-default)',
            borderRadius: '10px', padding: '10px 14px',
            color: 'var(--text-tertiary)', cursor: 'pointer',
            fontSize: '14px', fontFamily: 'var(--font-sans)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-orange)'; e.currentTarget.style.color = 'var(--brand-orange)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
        >
          <Plus size={15} />
          Add checklist item
        </button>
      )}
    </div>
  );
};

export default ChecklistEditor;
