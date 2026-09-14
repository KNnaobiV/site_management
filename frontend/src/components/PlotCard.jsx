import React from 'react';
import StatusBadge from './StatusBadge';
import Avatar from './Avatar';
import { MapPin, User, Calendar, DollarSign } from 'lucide-react';

const formatCurrency = (amount, currency = 'NGN') => {
  try {
    const locale = currency === 'USD' ? 'en-US' : currency === 'GBP' ? 'en-GB' : 'en-NG';
    return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toLocaleString()}`;
  }
};

const PlotCard = ({ plot, onClick }) => {
  const getFullName = (userObj) => {
    if (!userObj) return 'N/A';
    const first = userObj.first_name || '';
    const last = userObj.last_name || '';
    const full = `${first} ${last}`.trim();
    return full || userObj.username || 'N/A';
  };

  const foremenNames = plot.foremen && plot.foremen.length > 0 ? plot.foremen.map(getFullName).join(', ') : 'N/A';
  const firstForeman = plot.foremen && plot.foremen.length > 0 ? plot.foremen[0] : null;
  const budget = plot.budget || null;
  const allocated = parseFloat(budget?.allocated_amount ?? 0);
  const spent = parseFloat(budget?.spent_amount ?? 0);
  const currency = budget?.currency || 'NGN';
  const hasBudget = budget && allocated > 0;
  const overBudget = hasBudget && spent > allocated;

  const coverUrl = plot.cover_image?.img || (typeof plot.cover_image === 'string' ? plot.cover_image : null);

  return (
    <div className="card" onClick={onClick} style={{ cursor: 'pointer', padding: 0, overflow: 'hidden' }}>
      <div style={{ 
        height: '140px', 
        background: 'var(--bg-raised)',
        backgroundImage: coverUrl 
          ? `url(${coverUrl})`
          : `url(https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=600)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative'
      }}>
        <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
          <StatusBadge status={plot.status || "Planned"} />
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '20px', marginBottom: '4px' }}>{plot.address || 'Address N/A'}</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>Project: {plot.project_name || 'Project Name'}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <MapPin size={14} color="var(--brand-orange)" />
            <span>{plot.address || 'Location N/A'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-default)', paddingTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar user={firstForeman} name={foremenNames} size={24} />
              <div style={{ fontSize: '11px' }}>
                <p style={{ margin: 0, color: 'var(--text-tertiary)' }}>Foremen</p>
                <p style={{ margin: 0, fontWeight: 500 }}>{foremenNames}</p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>Progress</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{Math.max(0, Math.min(100, Number(plot.progress ?? 0)))}%</span>
            </div>
            <div style={{ height: '6px', background: 'var(--bg-raised)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.max(0, Math.min(100, Number(plot.progress ?? 0)))}%`,
                background: 'var(--brand-orange)',
                borderRadius: '3px',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
          {(hasBudget || spent > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', padding: '12px', background: overBudget ? 'rgba(220,38,38,0.08)' : 'rgba(34,197,94,0.08)', borderRadius: '14px', color: overBudget ? '#dc2626' : '#16a34a', fontWeight: 600, fontSize: '13px' }}>
              <DollarSign size={16} />
              {hasBudget ? (
                <span>{`${formatCurrency(spent, currency)} / ${formatCurrency(allocated, currency)}`}</span>
              ) : (
                <span>{`Spent: ${formatCurrency(spent, currency)}`}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlotCard;
