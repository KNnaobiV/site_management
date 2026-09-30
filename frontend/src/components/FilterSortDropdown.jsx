import React, { useState, useRef, useEffect } from 'react';

const FilterSortDropdown = ({ icon: Icon, label, options, value, onChange, style }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label || 'All';

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <button className="btn-ghost" onClick={() => setOpen(!open)} type="button">
        {Icon && <Icon size={16} />}
        <span>{label}: {selectedLabel}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '8px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: '12px',
          padding: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          zIndex: 100,
          minWidth: '200px',
          maxHeight: '300px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              type="button"
              style={{
                textAlign: 'left',
                padding: '8px 12px',
                background: value === opt.value ? 'var(--bg-raised)' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                color: value === opt.value ? 'var(--brand-orange)' : 'var(--text-primary)',
                fontWeight: value === opt.value ? 600 : 500,
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FilterSortDropdown;
