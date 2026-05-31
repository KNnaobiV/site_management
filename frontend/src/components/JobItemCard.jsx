import React from 'react';
import StatusBadge from './StatusBadge';
import Avatar from './Avatar';
import { Calendar, User, Zap, CheckSquare, CheckCircle2 } from 'lucide-react';

const ProgressRing = ({ progress, size = 60, strokeWidth = 5 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="var(--bg-raised)"
        strokeWidth={strokeWidth}
        fill="transparent"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="var(--brand-orange)"
        strokeWidth={strokeWidth}
        fill="transparent"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        style={{ 
          transform: 'rotate(90deg)', 
          transformOrigin: 'center',
          fontSize: '14px',
          fontWeight: 600,
          fontFamily: 'var(--font-sans)'
        }}
      >
        {progress}%
      </text>
    </svg>
  );
};

const JobItemCard = ({ job, onClick }) => {
  return (
    <div className="card" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <StatusBadge status={job.job_status} />
        {job.is_approved && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#edf5ed', color: '#2d5a27', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
            <CheckCircle2 size={12} />
            <span>Approved</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>{job.job_artisan} — {job.job_name}</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <CheckSquare size={14} color="var(--brand-orange)" />
              <span>{job.work_item_name || 'Work Item N/A'}</span>
            </div>
            
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--bg-raised)', padding: '4px 12px', borderRadius: '8px', fontSize: '13px', width: 'fit-content' }}>
              <Zap size={14} color="var(--brand-orange)" />
              <span>{job.job_artisan}</span>
            </div>
          </div>
        </div>
        
        <ProgressRing progress={job.progress || 65} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', borderTop: '1px solid var(--border-default)', paddingTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <Calendar size={14} />
          <span>Proposed end: {job.projected_end_date || '22 Jul 2026'}</span>
        </div>
        <Avatar name={job.artisan_name} size={32} />
      </div>
    </div>
  );
};

export default JobItemCard;
