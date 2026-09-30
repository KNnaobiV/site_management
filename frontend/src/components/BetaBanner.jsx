import React from 'react';
import { Sparkles, MessageSquare } from 'lucide-react';

export default function BetaBanner({ onOpenFeedback }) {
  return (
    <aside
      role="banner"
      aria-label="Beta preview announcement"
      style={{
        background: 'linear-gradient(90deg, rgba(193, 74, 30, 0.14) 0%, rgba(232, 123, 79, 0.09) 50%, rgba(193, 74, 30, 0.14) 100%)',
        borderBottom: '1px solid rgba(193, 74, 30, 0.22)',
        padding: '10px 24px',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
        fontSize: '13px',
        position: 'relative',
        zIndex: 40,
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 9px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              background: 'rgba(193, 74, 30, 0.18)',
              color: 'var(--brand-orange)',
              border: '1px solid rgba(193, 74, 30, 0.35)',
              flexShrink: 0,
            }}
          >
            <Sparkles size={12} />
            Beta
          </span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            You are viewing the preview release of <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>IronWork</strong>.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onOpenFeedback}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600,
              fontSize: '13px',
              color: 'var(--brand-orange)',
              background: 'rgba(193, 74, 30, 0.08)',
              border: '1px solid rgba(193, 74, 30, 0.2)',
              borderRadius: '8px',
              padding: '5px 12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none',
              fontFamily: 'inherit',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(193, 74, 30, 0.16)';
              e.currentTarget.style.borderColor = 'rgba(193, 74, 30, 0.35)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(193, 74, 30, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(193, 74, 30, 0.2)';
            }}
          >
            <MessageSquare size={14} />
            <span>Improvements & Complaints</span>
            <span aria-hidden="true" style={{ fontSize: '14px', lineHeight: 1 }}>&rarr;</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
