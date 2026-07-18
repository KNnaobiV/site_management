import React from 'react';
import StatusBadge from './StatusBadge';
import { Calendar, CheckCircle2, ArrowRight, MapPin } from 'lucide-react';

const WorkItemCard = ({ item, onClick }) => {
  return (
    <div className="card" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <StatusBadge status={item.work_status} />
      </div>

      <h3 style={{ fontSize: '24px', marginBottom: '8px' }}>{item.name}</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--brand-orange)', marginBottom: '12px' }}>
        <MapPin size={14} />
        <span>{item.construction_plot_name || 'Plot N/A'}</span>
      </div>
      <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '20px', lineHeight: 1.5 }}>
        {item.description || 'Phase description goes here...'}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <Calendar size={14} />
          <span>Proposed end: {item.proposed_end_date || '30 Sep 2026'}</span>
        </div>
        {item.is_approved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#edf5ed', color: '#2d5a27', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
            <CheckCircle2 size={12} />
            <span>Approved</span>
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '16px', display: 'flex', alignItems: 'center', color: 'var(--brand-orange)', fontWeight: 600, fontSize: '14px' }}>
        <span>12 jobs</span>
        <ArrowRight size={16} style={{ marginLeft: '4px' }} />
      </div>
    </div>
  );
};

export default WorkItemCard;
