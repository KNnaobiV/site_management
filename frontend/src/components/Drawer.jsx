import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Drawer({ isOpen, onClose, title, subtitle, children }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'flex-end',
      backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div 
        className="fade-in"
        style={{
          width: '100%',
          maxWidth: '600px',
          height: '100%',
          backgroundColor: '#000',
          color: '#fff',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.3s forwards',
        }} 
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: '32px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <h2 style={{ fontSize: '28px', marginBottom: '8px', fontFamily: 'var(--font-serif)', color: '#fff' }}>{title}</h2>
            {subtitle && <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: 0 }}>{subtitle}</p>}
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff'
            }}
          >
            <X size={20} />
          </button>
        </div>
        
        <div style={{
          padding: '32px',
          flex: 1,
          overflowY: 'auto'
        }}>
          {children}
        </div>
      </div>
      
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
