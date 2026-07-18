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

  const foremanName = getFullName(plot.foreman);
  const storekeeperName = getFullName(plot.storekeeper);
  const budget = plot.budget || null;
  const allocated = parseFloat(budget?.allocated_amount ?? 0);
  const spent = parseFloat(budget?.spent_amount ?? 0);
  const currency = budget?.currency || 'NGN';
  const hasBudget = budget && allocated > 0;
  const overBudget = hasBudget && spent > allocated;

  return (
    <div className="card" onClick={onClick} style={{ cursor: 'pointer', padding: 0, overflow: 'hidden' }}>
      <div style={{ 
        height: '140px', 
        background: '#eee',
        backgroundImage: `url(https://api.mapbox.com/styles/v1/mapbox/light-v10/static/pin-s+c14a1e(3.38,6.45)/3.38,6.45,14/400x200?access_token=pk.placeholder)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative'
      }}>
        <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
          <StatusBadge status="Planned" />
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

          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-default)', paddingTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar name={foremanName} size={24} />
              <div style={{ fontSize: '11px' }}>
                <p style={{ margin: 0, color: 'var(--text-tertiary)' }}>Foreman</p>
                <p style={{ margin: 0, fontWeight: 500 }}>{foremanName}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar name={storekeeperName} size={24} />
              <div style={{ fontSize: '11px' }}>
                <p style={{ margin: 0, color: 'var(--text-tertiary)' }}>Storekeeper</p>
                <p style={{ margin: 0, fontWeight: 500 }}>{storekeeperName}</p>
              </div>
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
