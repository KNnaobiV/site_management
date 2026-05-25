import React from 'react';
import StatusBadge from './StatusBadge';
import Avatar from './Avatar';
import { Calendar, Zap, CheckSquare, DollarSign } from 'lucide-react';

const formatCurrency = (amount, currency = 'NGN') => {
  try {
    const locale = currency === 'USD' ? 'en-US' : currency === 'GBP' ? 'en-GB' : 'en-NG';
    return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toLocaleString()}`;
  }
};

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
  const budget = job.budget || null;
  const spent = parseFloat(budget?.spent_amount ?? job.spent_amount ?? 0);
  const allocated = parseFloat(budget?.allocated_amount ?? 0);
  const currency = budget?.currency || 'NGN';
  const hasBudget = budget && allocated > 0;
  const overBudget = hasBudget && spent > allocated;
  const progress = hasBudget
    ? Math.min(100, Math.round(allocated > 0 ? (spent / allocated) * 100 : 0))
    : Math.max(0, Math.min(100, Number(job.progress ?? 0)));

  return (
    <div className="card" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <StatusBadge status={job.job_status} />
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

            {(hasBudget || spent > 0) && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: overBudget ? 'rgba(220,38,38,0.1)' : 'rgba(34,197,94,0.1)', padding: '6px 12px', borderRadius: '999px', color: overBudget ? '#dc2626' : '#16a34a', fontWeight: 600, fontSize: '13px' }}>
                <DollarSign size={14} />
                <span>{hasBudget ? `${formatCurrency(spent, currency)} / ${formatCurrency(allocated, currency)}` : `Spent: ${formatCurrency(spent, currency)}`}</span>
              </div>
            )}
          </div>
        </div>
        
        <ProgressRing progress={progress} />
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
