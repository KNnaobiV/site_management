import React from 'react';
import { X, HelpCircle } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      padding: '24px'
    }} onClick={onClose}>
      <div className="fade-in" style={{
        background: 'var(--bg-card)', borderRadius: '24px',
        border: '1px solid var(--border-subtle)',
        padding: '40px', width: '100%', maxWidth: '520px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.12)',
        position: 'relative'
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <HelpCircle size={24} color="var(--brand-orange)" />
            <h2 style={{ fontSize: '22px', margin: 0, color: 'var(--text-primary)' }}>{title}</h2>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', 
              padding: '4px', borderRadius: '8px', color: 'var(--text-tertiary)'
            }}
          >
            <X size={20} />
          </button>
        </div>
        
        {children}
      </div>
    </div>
  );
}
