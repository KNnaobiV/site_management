import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Breadcrumb component
 * @param {Array} items - [{label, to}] — last item has no `to` and renders as active
 */
const Breadcrumb = ({ items = [] }) => {
  const navigate = useNavigate();

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginBottom: '16px' }}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight size={14} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />}
            {isLast ? (
              <span style={{ fontSize: '14px', color: 'var(--brand-orange)', fontWeight: 600 }}>
                {item.label}
              </span>
            ) : (
              <button
                onClick={() => (item.path || item.to) && navigate(item.path || item.to)}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  fontSize: '14px', color: 'var(--text-secondary)',
                  cursor: (item.path || item.to) ? 'pointer' : 'default',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500
                }}
                onMouseEnter={e => { if (item.path || item.to) e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                {item.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumb;
